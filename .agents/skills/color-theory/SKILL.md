---
name: color-theory
description: "Guia completo de cor para projetos web: regra 60-30-10, cores semânticas (sucesso/alerta/erro), validação de contraste WCAG (mínimo 4.5:1), sistema de design tokens e implementação de dark mode. Cobre modelos de cor, harmonias, psicologia das cores e garante acessibilidade visual em todas as combinações usadas no projeto."
---

Apply color theory principles to improve the color system of this project.

1. COLOR AUDIT — Inventory all colors currently used in the project. How many unique colors are there? Are they defined as CSS variables/tokens or hardcoded as hex values? List every color with its frequency of use.

2. 60-30-10 RULE — Is the color distribution balanced? 60% dominant (backgrounds, large surfaces), 30% secondary (cards, sidebars, large components), 10% accent (CTAs, highlights, icons). Identify the current distribution and suggest adjustments.

3. COLOR HARMONY — What color harmony does the palette use (monochromatic, analogous, complementary, triadic, split-complementary)? Is it intentional? If the palette feels inconsistent, recommend a new harmony that fits the brand.

4. WCAG CONTRAST — Check every text/background combination:
- Body text on all backgrounds: must be 4.5:1 minimum
- Large text (18px+ or 14px+ bold): must be 3:1 minimum
- Disabled elements: may be lower but must be visually distinct
- Provide the exact contrast ratios and flag failures.

5. COLOR PSYCHOLOGY — What emotions do the current colors communicate? Are they aligned with the brand and audience expectations? (Blue = trust/tech, Green = growth/health, Red = urgency/error, Purple = premium/creative, Orange = energy/friendly).

6. DARK MODE — If dark mode exists: is the background a near-black (not pure #000, use #0a0a0a or similar)? Are there at least 3 surface levels (background, card, elevated card)? Are colored shadows used instead of black shadows?

Provide a revised color token set in CSS custom property format.
