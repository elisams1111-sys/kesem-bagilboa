import type { NextConfig } from "next";

// הגדרות Next.js. אין כאן סודות: כל המפתחות נקראים ממשתני סביבה.
const nextConfig: NextConfig = {
  // הקוד והתיקייה כוללים עברית; אין צורך בהגדרות מיוחדות, אבל נועלים את שורש הפרויקט
  // כדי ש-Turbopack לא יחפש lockfile בתיקיות שמעל.
  turbopack: { root: __dirname },
};

export default nextConfig;
