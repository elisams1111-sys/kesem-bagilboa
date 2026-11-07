// פרטי הקשר של האולם, במקום אחד. כרגע הם פיקטיביים, לבקשת המבקש (progress/2026-11-07-2315-landing-contact-links.md).
// הם נבחרו כך שלא יגיעו לאדם אמיתי: אחרי קידומת 04 לא מתחיל מספר ב-0, והכתובות ברשתות מסתיימות ב-.demo.
// כדי לעבור לפרטים האמיתיים מחליפים רק את הערכים כאן.

/** המספר כפי שמוצג באתר */
export const PHONE_DISPLAY = "04-000-0000";
/** אותו מספר בפורמט בינלאומי, בלי אפס מוביל ובלי מקפים: 972 + 4 + שבע ספרות */
const PHONE_INTL = "97240000000";

export const CONTACT = {
  phoneHref: `tel:+${PHONE_INTL}`,
  // wa.me פותח שיחה בוואטסאפ, באפליקציה או בדפדפן. הטקסט מוכן מראש בשדה ההודעה
  whatsappHref: `https://wa.me/${PHONE_INTL}?text=${encodeURIComponent("היי, אשמח לשמוע על אירוע בקסם בגלבוע")}`,
  facebookHref: "https://www.facebook.com/kesem.bagilboa.demo",
  instagramHref: "https://www.instagram.com/kesem.bagilboa.demo",
  tiktokHref: "https://www.tiktok.com/@kesem.bagilboa.demo",
};
