import { Session, parseMessage } from '../../../packages/runtime/src/session.ts';
let session: Session | undefined;
self.onmessage = (event: MessageEvent) => {
  const value=event.data;
  if(!value || !Number.isSafeInteger(value.requestId) || value.requestId<1) return;
  try {
    const message=parseMessage(value);
    session ??= new Session(message.sessionId);
    const state=session.dispatch(message);
    self.postMessage({version:1,sessionId:message.sessionId,requestId:value.requestId,ok:true,state});
  } catch(error) {
    self.postMessage({version:1,sessionId:value.sessionId,requestId:value.requestId,ok:false,error:error instanceof Error?error.message:'Error de sesión'});
  }
};
