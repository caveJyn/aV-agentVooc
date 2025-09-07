// import { useState, useEffect, useRef, useCallback } from "react";
// import { useSpring, animated, config } from "@react-spring/web";
// import { SpringValue } from "@react-spring/web";

// interface AnimatedDivProps {
//   className?: string;
//   style: { transform: SpringValue<string> };
//   children: React.ReactNode;
// }

// interface Testimonial {
//   quote: string;
//   author: string;
//   role: string;
//   image?: string;
// }

// interface TestimonialsSectionProps {
//   testimonialsSection: {
//     heading: string;
//     testimonials: Testimonial[];
//     trustSignal: string;
//   };
// }

// export const TestimonialsSection = ({ testimonialsSection }: TestimonialsSectionProps) => {
//   const heading = testimonialsSection.heading || "What Our Users Say";
//   const testimonials = testimonialsSection.testimonials.length > 0
//     ? testimonialsSection.testimonials
//     : [
//         { quote: "agentVooc saved us 20 hours a week!", author: "Jane D.", role: "Tech Lead", image: "https://via.placeholder.com/150" },
//         { quote: "The automation features are a game-changer.", author: "Mark S.", role: "Entrepreneur", image: "https://via.placeholder.com/150" },
//         { quote: "I love how easy it is to use.", author: "Sarah L.", role: "Developer", image: "https://via.placeholder.com/150" },
//         { quote: "Incredible tool for productivity!", author: "Alex P.", role: "Product Manager", image: "https://via.placeholder.com/150" },
//       ];

//   const trustSignal = testimonialsSection.trustSignal || "Join 10,000+ happy users automating their tasks.";
//   const total = testimonials.length;

//   const [index, setIndex] = useState(0);
//   const [isPaused, setIsPaused] = useState(false);
//   const intervalRef = useRef<NodeJS.Timeout | null>(null);

//   const loopedTestimonials = [...testimonials, ...testimonials, ...testimonials];
//   const loopOffset = total; // middle set starts at index `total`

//   const slideProps = useSpring({
//     transform: `translateX(-${(index + loopOffset) * 100}%)`,
//     config: config.molasses,
//   });

//   const trustBadgeProps = useSpring({
//     from: { opacity: 0, transform: "translateY(20px)" },
//     to: { opacity: 1, transform: "translateY(0)" },
//     delay: 500,
//     config: config.gentle,
//   });

//   // Autoplay logic
//   const startAutoplay = useCallback(() => {
//     if (intervalRef.current) clearInterval(intervalRef.current);
//     intervalRef.current = setInterval(() => {
//       setIndex((prev) => (prev + 1) % total);
//     }, 5000);
//   }, [total]);

//   useEffect(() => {
//     if (!isPaused) startAutoplay();
//     return () => intervalRef.current && clearInterval(intervalRef.current);
//   }, [isPaused, startAutoplay]);

//   const handleSelect = (i: number) => {
//     setIndex(i);
//     setIsPaused(true);
//     setTimeout(() => setIsPaused(false), 8000);
//   };

//   const handleNav = (dir: "next" | "prev") => {
//     setIndex((prev) => (dir === "next" ? (prev + 1) % total : (prev - 1 + total) % total));
//     setIsPaused(true);
//     setTimeout(() => setIsPaused(false), 6000);
//   };

//   const AnimatedDiv = animated.div as React.FC<AnimatedDivProps>;
//   const AnimatedBadge = animated.p;

//   return (
//     <section
//       className="py-16 px-4 bg-gradient-to-b from-agentvooc-primary-bg-dark to-agentvooc-secondary-accent/10"
//       aria-labelledby="testimonials-heading"
//     >
//       <div className="max-w-6xl mx-auto text-center">
//         <div className="mb-16">
//           <span className="inline-block px-4 py-1 bg-agentvooc-accent/10 text-agentvooc-accent rounded-full text-sm font-medium mb-4">
//             TESTIMONIALS
//           </span>
//           <h2 id="testimonials-heading" className="text-4xl md:text-5xl font-bold text-agentvooc-primary bg-clip-text text-transparent bg-gradient-to-r from-agentvooc-primary to-agentvooc-accent">
//             {heading}
//           </h2>
//         </div>

//         {/* Avatar Carousel */}
//         <div className="flex justify-center gap-3 mb-8 px-4 flex-wrap max-w-lg mx-auto">
//           {testimonials.map((t, i) => (
//             <button
//               key={i}
//               onClick={() => handleSelect(i)}
//               className={`relative group focus:outline-none`}
//               aria-label={`View testimonial from ${t.author}`}
//             >
//               <div
//                 className={`w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden transition-all duration-300 ${
//                   index === i
//                     ? "ring-2 ring-agentvooc-accent scale-110"
//                     : "ring-1 ring-agentvooc-secondary-accent/50 opacity-70 hover:opacity-100"
//                 }`}
//               >
//                 <img src={t.image || "/api/placeholder/150/150"} alt={t.author} className="w-full h-full object-cover" />
//               </div>
//               <span
//                 className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-xs px-2 py-0.5 rounded-full transition-all ${
//                   index === i
//                     ? "bg-agentvooc-accent text-agentvooc-primary-bg-dark opacity-100"
//                     : "opacity-0 group-hover:opacity-100 bg-agentvooc-secondary-accent text-agentvooc-primary"
//                 }`}
//               >
//                 {t.author}
//               </span>
//             </button>
//           ))}
//         </div>

//         {/* Scrolling Content */}
//         <div
//           className="overflow-hidden relative rounded-xl shadow-lg"
//           onMouseEnter={() => setIsPaused(true)}
//           onMouseLeave={() => setIsPaused(false)}
//         >
//           <AnimatedDiv className="flex w-full" style={slideProps}>
//             {loopedTestimonials.map((t, i) => (
//               <div
//                 key={`t-${i}`}
//                 className="min-w-full p-6 md:p-10 bg-gradient-to-br from-agentvooc-secondary-accent/90 to-agentvooc-secondary-accent/70 text-center rounded-xl flex flex-col items-center justify-center"
//               >
//                 <div className="bg-agentvooc-accent/10 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-6">
//                   <span className="text-agentvooc-accent text-5xl md:text-6xl font-serif">"</span>
//                 </div>
//                 <p className="text-lg md:text-xl text-agentvooc-secondary mb-6 font-medium leading-relaxed max-w-2xl mx-auto">
//                   {t.quote}
//                 </p>
//                 <div>
//                   <p className="text-agentvooc-primary font-bold text-lg">{t.author}</p>
//                   <p className="text-agentvooc-primary/70">{t.role}</p>
//                 </div>
//               </div>
//             ))}
//           </AnimatedDiv>

//           {/* Navigation Arrows */}
//           <div className="absolute inset-0 flex justify-between items-center px-4 pointer-events-none z-10">
//             <button
//               onClick={() => handleNav("prev")}
//               className="pointer-events-auto w-10 h-10 rounded-full bg-agentvooc-primary-bg-dark/80 text-agentvooc-accent border border-agentvooc-accent/30 shadow-md hover:scale-110 transition-all"
//               aria-label="Previous"
//             >
//               ←
//             </button>
//             <button
//               onClick={() => handleNav("next")}
//               className="pointer-events-auto w-10 h-10 rounded-full bg-agentvooc-primary-bg-dark/80 text-agentvooc-accent border border-agentvooc-accent/30 shadow-md hover:scale-110 transition-all"
//               aria-label="Next"
//             >
//               →
//             </button>
//           </div>

//           {/* Progress Dots */}
//           <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
//             {testimonials.map((_, i) => (
//               <button
//                 key={i}
//                 onClick={() => handleSelect(i)}
//                 className={`w-2 h-2 rounded-full transition-all ${
//                   index === i ? "bg-agentvooc-accent w-6" : "bg-agentvooc-secondary-accent hover:bg-agentvooc-primary"
//                 }`}
//                 aria-label={`Go to testimonial ${i + 1}`}
//               />
//             ))}
//           </div>
//         </div>

//         {/* Trust Badge */}
//         <AnimatedBadge style={trustBadgeProps} className="mt-12 inline-block px-6 py-3 bg-agentvooc-accent/10 border border-agentvooc-accent/20 text-agentvooc-accent rounded-full font-medium shadow-agentvooc-glow">
//           <span className="flex items-center justify-center gap-2">
//             ✅ {trustSignal}
//           </span>
//         </AnimatedBadge>
//       </div>
//     </section>
//   );
// };
