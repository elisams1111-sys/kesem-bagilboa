// האיור של דף הנחיתה: שולחן ערוך תחת פרגולה, בשקיעה בגלבוע. SVG בלי תמונות חיצוניות.
// slice ממלא כל מסך. בנייד נשאר גלוי רק מרכז האיור (x בין 510 ל-930 בערך), ולכן השולחן מרוכז שם.
// YMin מצמיד את האיור לראש המסך: במסך רחב נחתכת הקרקע הכהה למטה, ולא הפרגולה שמתחת לשם האולם.
// בתחתית האיור רקע כהה, כי שם יושבים הכותרת והכפתורים.

/** עיגול לשתי ספרות, כדי שהשרת והדפדפן יכתבו בדיוק אותו מספר ולא תהיה אי-התאמה בטעינה */
const r2 = (n: number) => Math.round(n * 100) / 100;

// רכסי הגלבוע, מהרחוק והבהיר אל הקרוב והכהה
const RIDGES = [
  { fill: "#7f8f6f", d: "M0 520 C160 470 280 500 420 455 C560 410 660 480 800 440 C960 395 1090 470 1230 430 C1320 405 1390 430 1440 415 V900 H0Z" },
  { fill: "#4c6650", d: "M0 590 C140 540 300 585 470 530 C620 485 760 575 920 525 C1080 480 1240 560 1440 500 V900 H0Z" },
];

function Candle({ x }: { x: number }) {
  return (
    <g>
      {/* פמוט עם שלושה נרות */}
      <rect x={x - 3} y="300" width="6" height="70" fill="#c79a56" />
      <rect x={x - 22} y="366" width="44" height="5" rx="2" fill="#c79a56" />
      <path d={`M${x - 26} 300 Q${x} 325 ${x + 26} 300`} fill="none" stroke="#c79a56" strokeWidth="4" />
      {[-26, 0, 26].map((dx) => (
        <g key={dx}>
          <rect x={x + dx - 4} y="262" width="8" height="38" fill="#fbf4e3" />
          <circle cx={x + dx} cy="248" r="24" fill="url(#glow)" opacity=".75" />
          <path className="string-light" d={`M${x + dx} 240 q7 11 0 18 q-7 -7 0 -18Z`} fill="#ffd27a" style={{ animationDelay: `${(x + dx) % 900}ms` }} />
        </g>
      ))}
    </g>
  );
}

function Glass({ x }: { x: number }) {
  return (
    <path d={`M${x - 8} 330 Q${x} 358 ${x + 8} 330Z M${x - 1} 348 V368 M${x - 7} 370 H${x + 7}`} fill="#f1d08a" fillOpacity=".55" stroke="#fbf4e3" strokeWidth="1.5" />
  );
}

export function TableScene() {
  return (
    <svg aria-hidden viewBox="0 0 1440 900" preserveAspectRatio="xMidYMin slice" className="absolute inset-0 size-full">
      <defs>
        <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14241b" />
          <stop offset=".42" stopColor="#3d5a48" />
          <stop offset=".62" stopColor="#c79a56" />
          <stop offset=".74" stopColor="#efd09a" />
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#fff4d6" />
          <stop offset=".3" stopColor="#ffe3a6" stopOpacity=".8" />
          <stop offset="1" stopColor="#ffe3a6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#dusk)" />
      <circle cx="720" cy="340" r="340" fill="url(#glow)" />
      {RIDGES.map((ridge) => (
        <path key={ridge.fill} {...ridge} />
      ))}
      {/* מרפסת כהה שעליה עומד השולחן */}
      <path d="M0 540 C300 490 500 472 720 472 C940 472 1150 490 1440 540 V900 H0Z" fill="#14221a" />
      {/* פרגולה */}
      <rect x="430" y="110" width="12" height="365" fill="#3c2f18" />
      <rect x="998" y="110" width="12" height="365" fill="#3c2f18" />
      <rect x="400" y="100" width="640" height="14" rx="3" fill="#3c2f18" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${436 + i * 188.7} 114 Q${530 + i * 188.7} ${178 - (i % 2) * 10} ${625 + i * 188.7} 114`} fill="none" stroke="#f6edd8" strokeOpacity=".5" strokeWidth="1.5" />
      ))}
      {Array.from({ length: 15 }, (_, i) => {
        const x = 436 + i * 40.4;
        const t = ((x - 436) % 188.7) / 188.7;
        return <circle key={i} className="string-light" cx={r2(x)} cy={r2(114 + 4 * t * (1 - t) * 32)} r="5" fill="#ffe3a6" style={{ animationDelay: `${(i * 430) % 3200}ms` }} />;
      })}
      {/* מפת השולחן עם קפלים */}
      <path d="M470 372 H970 V455 Q945 475 920 455 Q895 475 870 455 Q845 475 820 455 Q795 475 770 455 Q745 475 720 455 Q695 475 670 455 Q645 475 620 455 Q595 475 570 455 Q545 475 520 455 Q495 475 470 455Z" fill="#fbf4e3" />
      <rect x="465" y="368" width="510" height="8" rx="3" fill="#f1e3c3" />
      {[570, 670, 770, 870].map((x) => (
        <path key={x} d={`M${x} 376 V458`} stroke="#d9c79c" strokeWidth="2" />
      ))}
      {[600, 720, 840].map((x) => (
        <Candle key={x} x={x} />
      ))}
      {[505, 545, 895, 935].map((x) => (
        <Glass key={x} x={x} />
      ))}
      {/* זרי פרחים בין הפמוטים */}
      {[660, 780].map((x) =>
        [
          [-14, 0], [0, -8], [14, 0], [-6, 6], [8, 7],
        ].map(([dx, dy], i) => (
          <circle key={`${x}${i}`} cx={x + dx} cy={325 + dy} r="8" fill={i % 2 ? "#f1d08a" : "#ffffff"} stroke="#c79a56" strokeOpacity=".5" />
        )),
      )}
    </svg>
  );
}
