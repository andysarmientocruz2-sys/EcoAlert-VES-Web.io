import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, updateDoc } from 'firebase/firestore';
import { ensureAccount, savePreference, watchPreferences, watchAccount, saveReportAndProgress, readPreferences } from '../src/lib/account-sync';
import { identityPatch, buildReportDocs } from '../src/lib/progress';
import { saveQuizAction, markArticleRead, watchActivity, changeQuiz, EMPTY_QUIZ } from '../src/lib/activity-sync';

test('reingresar no sobrescribe el perfil personalizado ni el progreso', () => {
  assert.deepEqual(identityPatch({uid:'same',displayName:'Google',photoURL:'https://google.test/photo',email:'same@test.invalid'},
    {displayName:'Mi nombre',photoURL:'https://my.test/photo',email:'same@test.invalid',ecoPoints:700}), {});
  assert.deepEqual(readPreferences({notifications:false,emailNews:'bad'}), {notifications:false,publicProfile:true,emailNews:true});
});

test('quiz rechaza respuestas duplicadas y avances sin respuesta', () => {
  assert.deepEqual(changeQuiz(EMPTY_QUIZ,{type:'next',question:0},8),EMPTY_QUIZ);
  const answered=changeQuiz(EMPTY_QUIZ,{type:'answer',question:0,choice:2},8);
  assert.deepEqual(changeQuiz(answered,{type:'answer',question:0,choice:1},8),answered);
  assert.deepEqual(changeQuiz(answered,{type:'next',question:7},8),answered);
  assert.equal(changeQuiz(answered,{type:'next',question:0},8).index,1);
});

test('tres clientes: misma cuenta, cambios en vivo, reingreso, concurrencia y aislamiento', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST ? 'Requiere emuladores locales Auth y Firestore; no prueba producción.' : false,
  timeout: 60000,
}, async t => {
  const apps = ['web','windows','android'].map(name => initializeApp({projectId:'demo-ecoalert-sync',apiKey:'demo-key'}, `${name}-${Date.now()}`));
  const clients = apps.map(app => {
    const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {disableWarnings:true});
    const db = getFirestore(app);
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    connectFirestoreEmulator(db,host,Number(port)); return {auth,db};
  });
  const stops: (()=>void)[] = [];
  const listenerErrors: Error[] = [];
  t.after(async()=>{stops.forEach(stop=>stop()); await Promise.all(apps.map(deleteApp));});
  const [web,windows,android] = clients;
  const email = `sync-${Date.now()}@test.invalid`, password = 'Only-emulator-123!';
  const first = await createUserWithEmailAndPassword(web.auth,email,password);
  await Promise.all([signInWithEmailAndPassword(windows.auth,email,password),signInWithEmailAndPassword(android.auth,email,password)]);
  const uid = first.user.uid;
  assert.ok(clients.every(c=>c.auth.currentUser?.uid === uid));
  await Promise.all(clients.map(c=>ensureAccount(c.db,{uid,email,displayName:'Google'})));
  await updateDoc(doc(web.db,'users',uid),{displayName:'Mi nombre',photoURL:'https://example.test/photo',ecoPoints:100,achievements:['legacy']});
  const observed: Record<string, any> = {};
  clients.forEach((c,i)=>stops.push(watchAccount(c.db,uid,s=>{if(!s.metadata.fromCache && !s.metadata.hasPendingWrites) observed[i]=s.data();},e=>{listenerErrors.push(e);})));
  const waitFor = async (condition:()=>boolean) => {
    const limit=Date.now()+12000;
    while(!condition()) { if(Date.now()>limit) throw new Error('No llegó la actualización de otro cliente'); await new Promise(r=>setTimeout(r,50)); }
  };
  const report=(id:string)=>buildReportDocs({webType:'basura',description:id,userId:uid,userName:'Mi nombre',source:'web'},new Date().toISOString()).report;
  await Promise.all([
    saveReportAndProgress(web.db,uid,'report-a',report('a')),
    saveReportAndProgress(windows.db,uid,'report-b',report('b')),
  ]);
  await saveReportAndProgress(android.db,uid,'report-a',report('a')); // ambiguous retry, no duplicate reward
  await waitFor(()=>clients.every((_,i)=>observed[i]?.ecoPoints===200 && observed[i]?.reportsCount===2));
  assert.ok(observed[2].achievements.includes('legacy'));
  assert.equal(observed[2].displayName,'Mi nombre');
  await Promise.all([savePreference(web.db,uid,'notifications',false),savePreference(windows.db,uid,'emailNews',false)]);
  let preferences:any;
  stops.push(watchPreferences(android.db,uid,p=>{preferences=p;},e=>{listenerErrors.push(e);}));
  await waitFor(()=>preferences?.notifications===false && preferences?.emailNews===false);
  let learning:any;
  stops.push(watchActivity(android.db,uid,8,(quiz,articles)=>{learning={quiz,articles};},e=>{listenerErrors.push(e);}));
  await Promise.all([
    saveQuizAction(web.db,uid,{type:'answer',question:0,choice:2},8),
    saveQuizAction(windows.db,uid,{type:'answer',question:0,choice:2},8),
    markArticleRead(web.db,uid,'ART001'),
    markArticleRead(windows.db,uid,'ART002'),
  ]);
  await saveQuizAction(windows.db,uid,{type:'next',question:0},8);
  await waitFor(()=>learning?.quiz.index===1 && learning?.articles.length===2);
  assert.deepEqual(learning.quiz.answers,[2]);
  assert.equal(preferences.notifications,false);
  stops.splice(1,1)[0]?.();
  await signOut(windows.auth);
  await signInWithEmailAndPassword(windows.auth,email,password);
  await ensureAccount(windows.db,{uid,email,displayName:'Nombre antiguo de Google',photoURL:'https://old.test/photo'});
  const persisted=(await getDocFromServer(doc(windows.db,'users',uid))).data()!;
  assert.equal(persisted.displayName,'Mi nombre'); assert.equal(persisted.ecoPoints,200);
  stops.forEach(stop=>stop());
  assert.deepEqual(listenerErrors,[]);
  await signOut(android.auth);
  await createUserWithEmailAndPassword(android.auth,`other-${Date.now()}@test.invalid`,password);
  await assert.rejects(getDocFromServer(doc(android.db,'users',uid)),{code:'permission-denied'});
});
