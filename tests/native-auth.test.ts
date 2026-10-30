import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function adapter(platform: string, cancel = false) {
  const calls: string[] = [];
  const source = ts.transpileModule(readFileSync(new URL('../src/lib/native-auth.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  const modules: Record<string, any> = {
    '@capacitor/core': { Capacitor: { isNativePlatform: () => platform === 'android', getPlatform: () => platform } },
    '@capacitor-firebase/authentication': { FirebaseAuthentication: { signInWithGoogle: async (options: any) => {
      calls.push('native-google'); assert.equal(options.skipNativeAuth, true);
      if (cancel) throw new Error('cancelled');
      return { credential: { idToken: 'test-google-token' } };
    } } },
    'firebase/auth': {
      GoogleAuthProvider: { credential: (token: string) => { assert.equal(token, 'test-google-token'); return 'credential'; } },
      signInWithCredential: async () => { calls.push('firebase-credential'); return {user:{uid:'same-account'}}; },
      signInWithPopup: async () => { calls.push('web-popup'); return {user:{uid:'same-account'}}; },
      signInWithRedirect: async () => { calls.push('web-redirect'); },
    },
  };
  const window = platform === 'windows' ? {ecoalert:{platform:'windows', signInWithGoogle:async()=>{calls.push('windows-bridge'); return {idToken:'test-google-token'};}}} : {};
  runInNewContext(source, {exports,window,require:(id:string)=>modules[id]});
  return {exports,calls};
}
test('Android obtiene Google nativo y autentica la sesión JS usada por Firestore', async () => {
  const {exports,calls}=adapter('android');
  assert.equal((await exports.signInWithBestMethod({},{})).user.uid,'same-account');
  assert.deepEqual(calls,['native-google','firebase-credential']);
});
test('Windows canjea el token del puente y la web abre el popup dentro del clic', async () => {
  const desktop=adapter('windows'); await desktop.exports.signInWithBestMethod({},{});
  assert.deepEqual(desktop.calls,['windows-bridge','firebase-credential']);
  const web=adapter('web'); const pending=web.exports.signInWithBestMethod({},{});
  assert.deepEqual(web.calls,['web-popup']); await pending;
});
test('cancelar Google nativo no intenta un popup de WebView', async () => {
  const {exports,calls}=adapter('android',true);
  await assert.rejects(exports.signInWithBestMethod({},{}),/cancelled/);
  assert.deepEqual(calls,['native-google']);
});
