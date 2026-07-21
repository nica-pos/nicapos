import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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

/**
 * Sección de testimonios y reseñas de clientes reales de Nica-POS.
 * Se muestra en la landing para transmitir confianza y prueba social.
 */
export function Testimonials() {
  return (
    <section
      id="testimonios"
      className="border-t border-border/50 bg-gradient-to-b from-background to-muted/20 py-20"
    >
      <div className="container mx-auto px-4">
        {/* Encabezado de la sección */}
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            Reseñas verificadas
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Cientos de negocios en Nicaragua ya confían en Nica-POS
          </h2>
          <p className="mt-4 text-muted-foreground">
            Descubre por qué comerciantes, farmacias, ferreterías y boutiques
            eligen nuestro sistema todos los días.
          </p>
        </div>

        {/* Grid de tarjetas de testimonios */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <Card
              key={t.name}
              className="group relative overflow-hidden border-border/60 bg-card/60 backdrop-blur transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardContent className="p-6">
                {/* Ícono decorativo de comilla */}
                <Quote className="mb-3 h-6 w-6 text-primary/30" />

                {/* Estrellas de calificación */}
                <div
                  className="mb-3 flex gap-0.5"
                  aria-label={`${t.rating} de 5 estrellas`}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={
                        i < t.rating
                          ? "h-4 w-4 fill-yellow-400 text-yellow-400"
                          : "h-4 w-4 text-muted-foreground/30"
                      }
                    />
                  ))}
                </div>

                {/* Comentario del cliente */}
                <p className="mb-6 text-sm leading-relaxed text-foreground/90">
                  “{t.comment}”
                </p>

                {/* Datos del cliente */}
                <div className="flex items-center gap-3 border-t border-border/50 pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary">
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.role} · {t.business} · {t.location}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Métricas resumen */}
        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-6 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur sm:grid-cols-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">4.9★</p>
            <p className="mt-1 text-xs text-muted-foreground">Calificación promedio</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">+500</p>
            <p className="mt-1 text-xs text-muted-foreground">Negocios activos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">99.9%</p>
            <p className="mt-1 text-xs text-muted-foreground">Uptime garantizado</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">24/7</p>
            <p className="mt-1 text-xs text-muted-foreground">Soporte en español</p>
          </div>
        </div>
      </div>
    </section>
  );
}
