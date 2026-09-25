"use client";

import { useRouter } from "next/navigation";
import { QuoteCalculator, quoteMessage } from "@/components/quotecalculator";

export default function QuotePage() {
  const router = useRouter();

  // Accepting a price sends them to the contact form with the quote already
  // written into the message. Two pages, but nothing to type twice.
  function book(quote) {
    const text = quoteMessage(quote);
    router.push(`/contact?reason=book&quote=${encodeURIComponent(text)}`);
  }

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">Quotes</p>
          <h1>
            What will
            <br />
            it cost?
          </h1>
          <p className="lede">
            Tell me about the game and you get a price straight away — no
            waiting on me to reply. It is an estimate, not an invoice: send it
            over and I will confirm before anything is booked.
          </p>
        </div>
      </section>

      <QuoteCalculator onBook={book} />
    </>
  );
}
