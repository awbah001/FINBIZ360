import { useEffect, useState, type CSSProperties } from "react";
import { type Icon as PhosphorIcon } from "@phosphor-icons/react";
import "./landing-nav.css";

export type LandingNavItem = { name: string; url: string; icon: PhosphorIcon };

export default function LandingNav({ items }: { items: LandingNavItem[] }) {
  const [activeTab, setActiveTab] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let active = 0;
      items.forEach((item, index) => {
        const section = document.getElementById(item.url.slice(1));
        if (
          section &&
          section.getBoundingClientRect().top <=
            Math.min(180, window.innerHeight * 0.3)
        )
          active = index;
      });
      setActiveTab(active);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("hashchange", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("hashchange", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [items]);
  return (
    <nav
      className="landing-nav"
      aria-label="Main navigation"
      style={
        {
          "--active-tab": activeTab,
          "--nav-count": items.length,
        } as CSSProperties
      }
    >
      <span className="landing-nav-lamp" aria-hidden="true" />
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <a
            key={item.url}
            className="landing-nav-link"
            href={item.url}
            aria-label={item.name}
            aria-current={activeTab === index ? "location" : undefined}
            title={item.name}
            onClick={() => setActiveTab(index)}
          >
            <span className="landing-nav-label">{item.name}</span>
            <Icon
              className="landing-nav-icon"
              size={21}
              weight={activeTab === index ? "fill" : "regular"}
              aria-hidden="true"
              focusable="false"
            />
          </a>
        );
      })}
    </nav>
  );
}
