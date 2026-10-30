import { useEffect, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { EMPTY_QUIZ, readQuiz, changeQuiz, watchActivity, saveQuizAction, markArticleRead, type QuizAction } from './activity-sync';

export function useSyncedActivity(db: Firestore | null, uid: string | undefined, count: number, onError: (message: string) => void) {
  const [quiz,setQuiz]=useState(EMPTY_QUIZ);
  const [articles,setArticles]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const lock=useRef(false);
  useEffect(()=> {
    setQuiz(EMPTY_QUIZ); setArticles([]); setReady(false);
    if (db && uid) return watchActivity(db,uid,count,(q,a)=>{setQuiz(q);setArticles(a);setReady(true);},()=>{
      onError('No se pudo cargar tu progreso de aprendizaje. Revisa la conexión y los permisos de Firebase.');
    });
    try {
      const saved=JSON.parse(localStorage.getItem('eco_learning_guest') || '{}');
      setQuiz(readQuiz(saved.quiz,count)); setArticles(Array.isArray(saved.articles)?saved.articles:[]);
    } catch {}
    setReady(true);
  },[db,uid,count,onError]);
  const saveLocal=(q:typeof quiz,a:string[])=> {
    localStorage.setItem('eco_learning_guest',JSON.stringify({quiz:q,articles:a}));
    setQuiz(q);setArticles(a);
  };
  const act=async(action:QuizAction)=> {
    if(lock.current || !ready) return;
    lock.current=true;setBusy(true);
    try {
      if(db && uid) await saveQuizAction(db,uid,action,count);
      else saveLocal(changeQuiz(quiz,action,count),articles);
    } catch { onError('No se pudo guardar la respuesta. Revisa tu conexión y vuelve a intentarlo.'); }
    finally {lock.current=false;setBusy(false);}
  };
  const markRead=async(id:string)=> {
    if(!ready) return;
    try {
      if(db && uid) await markArticleRead(db,uid,id);
      else saveLocal(quiz,[...new Set([...articles,id])]);
    } catch {onError('No se pudo guardar el artículo leído. Vuelve a intentarlo.');}
  };
  return {quiz,articles,act,markRead,busy:busy || !ready};
}
