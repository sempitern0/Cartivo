<script lang="ts">
import { Session, type Command, type State } from '../../../packages/runtime/src/session.ts';
let session = new Session('diagnostic');
let sessionState = $state<State>('idle');
let error = $state('');
function send(command: Command) {
  try { sessionState=session.dispatch({version:1,sessionId:session.id,command}); error=''; }
  catch(e) { error=e instanceof Error ? e.message : 'Error desconocido'; }
}
function restart() { session.dispose(); session=new Session(crypto.randomUUID()); sessionState=session.state; error=''; }
</script>
<svelte:head><meta name="description" content="Cartivo: tu colección retro, en tu dispositivo." /></svelte:head>
<main>
<header><span class="brand">CARTIVO<span class="dot">●</span></span><span>Laboratorio · H1-A</span></header>
<section><p class="eyebrow">TU PRÓXIMA PARTIDA EMPIEZA AQUÍ</p><h1>Un lugar para<br />volver a jugar.</h1><p class="intro">Tu colección, tus controles, tu pantalla. Estamos construyendo la primera experiencia NES.</p></section>
<div class="grid"><article><span class="tag">PRIMER SISTEMA</span><h2>Nintendo Entertainment System</h2><p>Integración del núcleo pendiente. Los juegos todavía no se pueden ejecutar.</p><button disabled>Jugar · próximamente</button></article>
<article><span class="tag">DIAGNÓSTICO · SIN EMULACIÓN</span><h2>Control de sesión</h2><p>Comprueba el ciclo de vida de la aplicación con una sesión simulada.</p><p role="status">Estado: <strong>{sessionState}</strong></p><div class="controls"><button onclick={()=>send('start')} disabled={sessionState!=='idle'}>Iniciar</button><button onclick={()=>send(sessionState==='paused'?'resume':'pause')} disabled={sessionState!=='running' && sessionState!=='paused'}>{sessionState==='paused'?'Reanudar':'Pausar'}</button><button onclick={()=>send('stop')} disabled={sessionState==='stopped'}>Detener</button><button onclick={restart}>Nueva sesión</button></div>{#if error}<p role="alert">{error}</p>{/if}</article></div>
<footer>Archivos locales · Sin juegos incluidos · Núcleo NES, guardados y modo offline pendientes</footer>
</main>
<style>
:global(body){margin:0;background:#101713;color:#eff6ed;font-family:system-ui,sans-serif}:global(*){box-sizing:border-box}main{max-width:1100px;margin:auto;padding:32px}header{display:flex;justify-content:space-between;gap:16px;color:#aebbad}.brand{font-size:24px;font-weight:800;letter-spacing:3px;color:#eff6ed}.dot{color:#c2f970;padding-left:10px}section{padding:70px 0 40px}.eyebrow,.tag{font-size:12px;letter-spacing:2px;color:#c2f970}h1{font-size:clamp(40px,7vw,76px);line-height:1.05;margin:20px 0}.intro{max-width:520px;font-size:19px;color:#bcc8ba;line-height:1.7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{background:#1a241d;border:1px solid #344336;padding:28px;border-radius:20px}article p{line-height:1.6;color:#bcc8ba}button{background:#c2f970;color:#152011;border:0;border-radius:9px;padding:12px 16px;font:inherit;cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible{outline:3px solid white;outline-offset:4px}.controls{display:flex;gap:10px;flex-wrap:wrap}footer{padding:36px 0;color:#aebbad;font-size:13px}@media(max-width:700px){main{padding:20px}.grid{grid-template-columns:1fr}header{flex-wrap:wrap}section{padding-top:40px}}
</style>

