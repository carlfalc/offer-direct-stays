import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import landingHtml from "./landing/findastay-landing.html?raw";
import { initLanding } from "./landing/initLanding";
import "./landing/findastay-landing.css";

/** findastay brand landing. The markup, styles and behaviour live alongside this
 *  component so the look can be reused across the app. `initialView` lets the
 *  /new-era and /faq routes deep-link straight to a section. */
export default function FindAStayLanding({ initialView = "home" }: { initialView?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.innerHTML = landingHtml;
    const cleanup = initLanding(root, navigate, initialView);
    return cleanup;
  }, [initialView, navigate]);

  return <div className="fas-landing" ref={rootRef} />;
}
