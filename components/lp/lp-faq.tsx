"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { LP_FAQ, LP_FAQ_OPEN_COUNT } from "@/lib/lp-content"

const itemValue = (index: number) => `faq-${index}`

/** 最初の2問(料金・インストール)は開いた状態で出す(UIUX改装 項目13) */
const OPEN_BY_DEFAULT = LP_FAQ.slice(0, LP_FAQ_OPEN_COUNT).map((_, index) => itemValue(index))

export function LpFaq() {
  return (
    <section id="faq" className="bg-[#F3EFE4] py-28 md:py-36">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <p data-reveal className="mb-4 text-center text-sm font-semibold tracking-[0.2em] text-[#C77E1B]">
          FAQ
        </p>
        <h2 data-reveal className="font-lp-display text-center text-3xl font-black text-[#2B2723] md:text-[2.6rem]">
          よくあるご質問
        </h2>

        <div data-reveal className="mt-12">
          <Accordion type="multiple" defaultValue={OPEN_BY_DEFAULT} className="space-y-3">
            {LP_FAQ.map((item, index) => (
              <AccordionItem
                key={item.q}
                value={itemValue(index)}
                className="rounded-2xl border border-[#2B2723]/8 bg-white px-6 shadow-sm"
              >
                <AccordionTrigger className="py-5 text-left text-base font-bold text-[#2B2723] hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-[#2B2723]/80">
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
