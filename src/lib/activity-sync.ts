import { doc, onSnapshot, runTransaction, setDoc, arrayUnion, type Firestore } from 'firebase/firestore';

export type QuizProgress = { index: number; answers: number[]; done: boolean };
export type QuizAction = { type: 'answer'; question: number; choice: number } | { type: 'next'; question: number } | { type: 'reset' };
export const EMPTY_QUIZ: QuizProgress = { index: 0, answers: [], done: false };
export function readQuiz(value: any, count: number): QuizProgress {
  if (!value || !Number.isInteger(value.index) || value.index < 0 || value.index >= count ||
      !Array.isArray(value.answers) || value.answers.length > count || value.index > value.answers.length ||
      value.answers.some((n: unknown) => !Number.isInteger(n) || Number(n) < 0 || Number(n) > 3)) return EMPTY_QUIZ;
  return { index:value.index, answers:value.answers, done:value.done === true && value.answers.length === count };
}
export function changeQuiz(previous: QuizProgress, action: QuizAction, count: number): QuizProgress {
  if (action.type === 'reset') return EMPTY_QUIZ;
  if (previous.done || action.question !== previous.index) return previous;
  if (action.type === 'answer') {
    if (previous.answers.length > previous.index || !Number.isInteger(action.choice) || action.choice < 0 || action.choice > 3) return previous;
    return { ...previous, answers:[...previous.answers,action.choice] };
  }
  if (previous.answers.length <= previous.index) return previous;
  return previous.index + 1 === count ? { ...previous, done:true } : { ...previous, index:previous.index+1 };
}
export function watchActivity(db: Firestore, uid: string, count: number, next: (quiz: QuizProgress, articles: string[]) => void, error: (e: Error) => void) {
  return onSnapshot(doc(db,'webProfiles',uid), snap => {
    const data=snap.data();
    next(readQuiz(data?.practiceQuizV1,count),Array.isArray(data?.readArticles) ? data.readArticles.filter((x: unknown)=>typeof x==='string') : []);
  }, error);
}
export function saveQuizAction(db: Firestore, uid: string, action: QuizAction, count: number) {
  const ref=doc(db,'webProfiles',uid);
  return runTransaction(db, async tx=> {
    const snap=await tx.get(ref);
    tx.set(ref,{practiceQuizV1:changeQuiz(readQuiz(snap.data()?.practiceQuizV1,count),action,count)},{merge:true});
  });
}
export function markArticleRead(db: Firestore, uid: string, id: string) {
  return setDoc(doc(db,'webProfiles',uid),{readArticles:arrayUnion(id)},{merge:true});
}
