import { redirect } from "next/navigation";

// The quote calculator lives on the contact page now, at the top, so a price
// and the form that sends it are one page rather than two. This redirect
// stays because /quote has been in the nav and may be in a link someone
// saved -- a dead URL on a small site is a lost booking.
export default function QuoteRedirect() {
  redirect("/contact");
}
