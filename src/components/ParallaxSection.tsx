import { useRef, useEffect, useState, ReactNode } from 'react';

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  fadeIn?: boolean;
}

export function ParallaxSection({ children, className = '', speed = 0.3, fadeIn = true }: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isVisible, setIsVisible] = useState(!fadeIn);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const elementCenter = rect.top + rect.height / 2;
      const distanceFromCenter = elementCenter - windowHeight / 2;
      setOffset(distanceFromCenter * speed * -0.1);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${fadeIn ? (isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8') : ''} ${className}`}
      style={{ transform: `translateY(${offset}px)${isVisible ? '' : ' translateY(32px)'}` }}
    >
      {children}
    </div>
  );
}
