"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { LP_FAQ } from "@/lib/lp-content"

export function LpFaq() {
  return (
    <section id="faq" className="bg-[#FBF9F5] py-28 md:py-36">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <p data-reveal className="mb-4 text-center text-sm font-semibold tracking-[0.2em] text-[#C77E1B]">
          FAQ
        </p>
        <h2 data-reveal className="font-lp-display text-center text-3xl font-semibold text-[#16233A] md:text-[2.6rem]">
          よくあるご質問
        </h2>

        <div data-reveal className="mt-12">
          <Accordion type="single" collapsible className="space-y-3">
            {LP_FAQ.map((item, index) => (
              <AccordionItem
                key={item.q}
                value={`faq-${index}`}
                className="rounded-2xl border border-[#16233A]/8 bg-white px-6 shadow-sm"
              >
                <AccordionTrigger className="py-5 text-left text-base font-bold text-[#16233A] hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-[#16233A]/70">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
