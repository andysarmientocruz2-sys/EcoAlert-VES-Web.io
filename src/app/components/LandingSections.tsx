import { Camera, MapPin, Leaf, Eye, BookOpen, Trophy, ArrowRight, Users } from 'lucide-react';

type Destination = 'report' | 'map' | 'education' | 'gamification' | 'community';
export function HowItWorks({ navigate }: { navigate: (page: Destination) => void }) {
  const steps = [
    { icon: Eye, title: 'Detecta', text: 'Observa un problema ambiental en tu barrio.', color: '#4ADE80' },
    { icon: Camera, title: 'Reporta', text: 'Agrega una foto, una descripción y su ubicación.', color: '#00D4FF' },
    { icon: MapPin, title: 'Visualiza', text: 'Encuentra los reportes y conoce lo que pasa cerca.', color: '#FBBF24' },
    { icon: Leaf, title: 'Participa', text: 'Comparte información y suma acciones por tu comunidad.', color: '#A78BFA' },
  ];
  return <>
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
      <p className="eco-eyebrow">DEL PROBLEMA A LA ACCIÓN</p>
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Un pequeño reporte.<br /><span className="text-primary">Un gran primer paso.</span></h2>
      <p className="text-muted-foreground max-w-xl mb-10">Cuidar Villa El Salvador empieza por hacer visible lo que necesita cambiar. Así puedes participar.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map(({ icon: Icon, title, text, color }, i) => <div key={title} className="eco-feature p-6">
          <div className="flex justify-between items-center mb-7"><span className="p-3 rounded-xl" style={{ color, background: `${color}12` }}><Icon size={23} /></span><span className="text-3xl font-bold text-white/10">0{i + 1}</span></div>
          <h3 className="font-bold text-lg mb-2">{title}</h3><p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
        </div>)}
      </div>
    </section>
    <section className="border-y border-border bg-card/30 py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-9"><div><p className="eco-eyebrow">TU COMUNIDAD, CONECTADA</p><h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Más formas de <span className="text-primary">hacer la diferencia.</span></h2></div></div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { title: 'Aprende para actuar', description: 'Explora recursos sobre reciclaje, agua y contaminación. Lleva lo aprendido a tu día a día.', label: 'Explorar recursos', page: 'education' as const, icon: BookOpen, color: '#00D4FF' },
            { title: 'Cada acción cuenta', description: 'Consulta tus EcoPuntos, tus insignias y los retos que te animan a seguir participando.', label: 'Ver mis retos', page: 'gamification' as const, icon: Trophy, color: '#FBBF24' },
            { title: 'Tu voz se suma', description: 'Descubre los reportes de otros vecinos, comparte observaciones y participa en la conversación.', label: 'Ir a la comunidad', page: 'community' as const, icon: Users, color: '#4ADE80' },
          ].map(({ title, description, label, page, icon: Icon, color }) => <button key={page} onClick={() => navigate(page)} className="eco-feature p-7 text-left group flex flex-col items-start">
            <span className="rounded-2xl p-4 mb-7" style={{ color, background: `${color}12` }}><Icon size={28} /></span>
            <h3 className="text-xl font-bold mb-3">{title}</h3><p className="text-sm text-muted-foreground leading-relaxed mb-7 flex-1">{description}</p>
            <span className="text-sm font-semibold flex items-center gap-2" style={{ color }}>{label}<ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></span>
          </button>)}
        </div>
      </div>
    </section>
  </>;
}

export function MissionFooter({ navigate }: { navigate: (page: Destination) => void }) {
  return <>
    <section className="eco-mission text-center px-5 py-20 sm:py-28">
      <span className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-6"><Leaf size={26} /></span>
      <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">El futuro de Villa El Salvador<br /><span className="text-primary">se construye contigo.</span></h2>
      <p className="text-muted-foreground max-w-lg mx-auto my-6">Cada reporte hace visible un problema. Cada persona puede ser parte del cambio.</p>
      <button onClick={() => navigate('report')} className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-7 py-4 rounded-xl hover:brightness-110 transition">Hacer mi primer reporte<ArrowRight size={18} /></button>
    </section>
    <footer className="border-t border-border px-5 py-8"><div className="max-w-7xl mx-auto flex flex-wrap gap-5 items-center justify-between">
      <div><p className="font-bold text-primary flex gap-2 items-center"><Leaf size={19} /> EcoAlert VES</p><p className="text-xs text-muted-foreground mt-2">Tecnología y participación ciudadana.</p></div>
      <div className="flex gap-5 text-sm text-muted-foreground"><button onClick={() => navigate('map')}>Mapa</button><button onClick={() => navigate('education')}>Aprende</button><button onClick={() => navigate('community')}>Comunidad</button></div>
      <p className="text-xs text-muted-foreground">Hecho para Villa El Salvador · 2026</p>
    </div></footer>
  </>;
}
