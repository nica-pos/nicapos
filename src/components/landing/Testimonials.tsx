import { Star, Quote } from "lucide-react";

type Testimonial = {
  name: string;
  role: string;
  business: string;
  location: string;
  rating: number;
  comment: string;
  initials: string;
};

const testimonials: Testimonial[] = [
  {
    name: "María Fernanda López",
    role: "Dueña",
    business: "Boutique Estilo MFL",
    location: "Managua",
    rating: 5,
    comment:
      "Nica-POS me cambió el negocio. Ahora facturo en segundos y llevo el inventario de mis 2 sucursales al día. El soporte en español es excelente.",
    initials: "MF",
  },
  {
    name: "Carlos Ramírez",
    role: "Administrador",
    business: "Ferretería El Constructor",
    location: "León",
    rating: 5,
    comment:
      "Lo mejor es que trabaja en Córdobas y Dólares sin complicarme. Los reportes de IVA me ahorran horas cada mes. 100% recomendado.",
    initials: "CR",
  },
  {
    name: "Ana Sofía Mendoza",
    role: "Gerente",
    business: "Minimarket La Esquina",
    location: "Granada",
    rating: 5,
    comment:
      "Instalé Nica-POS en la tablet y mis cajeros aprendieron en un día. Las ventas a crédito y el control de clientes son geniales.",
    initials: "AS",
  },
  {
    name: "Roberto Sequeira",
    role: "Propietario",
    business: "Repuestos Sequeira",
    location: "Estelí",
    rating: 5,
    comment:
      "Antes usaba Excel y perdía datos. Con Nica-POS tengo respaldo en la nube y puedo ver mis ventas desde el celular donde sea.",
    initials: "RS",
  },
  {
    name: "Jessica Morales",
    role: "Cajera principal",
    business: "Farmacia Buena Salud",
    location: "Masaya",
    rating: 5,
    comment:
      "La interfaz es rapidísima y no se traba. Facturar carta o ticket con un clic es lo que necesitábamos. ¡Gracias equipo Nica-POS!",
    initials: "JM",
  },
  {
    name: "Luis Alberto Cruz",
    role: "Contador",
    business: "Distribuidora Cruz",
    location: "Chinandega",
    rating: 5,
    comment:
      "Los reportes fiscales y de utilidad son claros. Cerrar caja al final del día toma minutos. Excelente inversión para cualquier negocio.",
    initials: "LC",
  },
];

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <figure className="w-[20rem] shrink-0 rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40 sm:w-[23rem]">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5" aria-label={`${t.rating} de 5 estrellas`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={
                i < t.rating
                  ? "h-3.5 w-3.5 fill-warning text-warning"
                  : "h-3.5 w-3.5 text-muted-foreground/30"
              }
            />
          ))}
        </div>
        <Quote className="h-5 w-5 text-primary/25" />
      </div>

      <blockquote className="mt-4 text-sm leading-relaxed text-foreground/90">
        “{t.comment}”
      </blockquote>

      <figcaption className="mt-6 flex items-center gap-3 border-t border-border/50 pt-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 text-sm font-semibold text-primary">
          {t.initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{t.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t.role} · {t.business} · {t.location}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

/**
 * Sección de testimonios en formato de carrusel infinito (marquesina)
 * para dar movimiento y modernidad a la landing.
 */
export function Testimonials() {
  const rowA = testimonials.slice(0, 3);
  const rowB = testimonials.slice(3);

  return (
    <section id="testimonios" className="relative overflow-hidden border-y border-border/50 py-24">
      <div className="pointer-events-none absolute inset-0 bg-radial-glow opacity-70" />

      <div className="relative mx-auto mb-14 max-w-3xl px-4 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
          Reseñas verificadas
        </div>
        <h2 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          Cientos de negocios ya
          <br className="hidden sm:block" /> confían en Nica-POS
        </h2>
        <p className="mt-4 text-muted-foreground">
          Comerciantes, farmacias, ferreterías y boutiques lo usan todos los días.
        </p>
      </div>

      <div className="relative flex flex-col gap-4">
        <div className="marquee-mask flex overflow-hidden">
          <div className="animate-marquee flex shrink-0 gap-4 pr-4">
            {[...rowA, ...rowA].map((t, i) => (
              <TestimonialCard key={`a-${t.name}-${i}`} t={t} />
            ))}
          </div>
          <div className="animate-marquee flex shrink-0 gap-4 pr-4" aria-hidden>
            {[...rowA, ...rowA].map((t, i) => (
              <TestimonialCard key={`a2-${t.name}-${i}`} t={t} />
            ))}
          </div>
        </div>

        <div className="marquee-mask flex overflow-hidden">
          <div className="animate-marquee-reverse flex shrink-0 gap-4 pr-4">
            {[...rowB, ...rowB].map((t, i) => (
              <TestimonialCard key={`b-${t.name}-${i}`} t={t} />
            ))}
          </div>
          <div className="animate-marquee-reverse flex shrink-0 gap-4 pr-4" aria-hidden>
            {[...rowB, ...rowB].map((t, i) => (
              <TestimonialCard key={`b2-${t.name}-${i}`} t={t} />
            ))}
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 px-0 sm:grid-cols-4">
        {[
          { k: "4.9★", v: "Calificación promedio" },
          { k: "+500", v: "Negocios activos" },
          { k: "99.9%", v: "Uptime garantizado" },
          { k: "24/7", v: "Soporte en español" },
        ].map((m) => (
          <div key={m.v} className="bg-card px-4 py-6 text-center">
            <p className="text-2xl font-bold text-foreground">{m.k}</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
