/** The one place every donation destination is defined. The /donate route,
 *  the footer links, and the admin QR panel all read from here so the three
 *  giving options can never drift apart. */

/** Pittsburgh Foundation endowment fund, the official program fund. */
export const FOUNDATION_DONATE_URL =
  "https://pittsburghfoundation.org/fundsearch?form=donate&q=Endowment%20for%20Pitt%20Ultimate&designationId=EYVXEKTZ&modifyDesignation=no";

/** PayPal personal link. Goes to Brody Brotman personally, not to the club. */
export const PAYPAL_DONATE_URL = "https://paypal.me/williambrotman";

/** Venmo personal link. Goes to Brody Brotman personally, not to the club. */
export const VENMO_DONATE_URL = "https://venmo.com/William-Brotman";
