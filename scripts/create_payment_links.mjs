/**
 * Create 4 Stripe Payment Links for the credit packs.
 *
 * Prod set (default):
 *   node scripts/create_payment_links.mjs
 * Dev set (returns to the local dev server):
 *   node scripts/create_payment_links.mjs --redirect=http://localhost:5173/realtime_space_travel/shop/success
 *
 * A Payment Link's return URL is baked into the Stripe object, so dev and prod
 * need separate links — see getPaymentLinkUrl() in src/constants/shopCatalog.ts.
 *
 * Requires VITE_STRIPE_SECRET_KEY in .env.
 */
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { loadEnv } from "vite";

// Empty prefix so loadEnv returns every var, not just the VITE_ ones.
const rootDir = fileURLToPath(new URL("..", import.meta.url));
const env = loadEnv(process.env.NODE_ENV ?? "development", rootDir, "");

const secretKey = env.VITE_STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("❌ Missing VITE_STRIPE_SECRET_KEY in .env — see .env.example.");
  process.exit(1);
}

const stripe = new Stripe(secretKey);

const PROD_REDIRECT_URL = "https://realtimespacetravel-e74e3.web.app/shop/success";
const redirectUrl =
  process.argv.find((a) => a.startsWith("--redirect="))?.slice("--redirect=".length) ??
  PROD_REDIRECT_URL;

console.log(`Return URL: ${redirectUrl}\n`);

const PACKS = [
  { id: "credits-starter",  name: "Starter Pack",   priceEur: 5,   credits: 100  },
  { id: "credits-advanced", name: "Advanced Pack",   priceEur: 10,  credits: 300  },
  { id: "credits-premium",  name: "Premium Pack",    priceEur: 25,  credits: 700  },
  { id: "credits-ultra",    name: "Ultra Pack",      priceEur: 100, credits: 2000 },
];

async function main() {
  const results = [];

  for (const pack of PACKS) {
    console.log(`Creating Payment Link for ${pack.name} (${pack.priceEur}€)...`);

    // Create a price first (needed for Payment Link)
    const product = await stripe.products.create({
      name: `Realtime Space Travel - ${pack.name}`,
      description: `${pack.credits}⭐ credits for Realtime Space Travel`,
      metadata: { credit_pack_id: pack.id, credits: String(pack.credits) },
    });

    const price = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: pack.priceEur * 100, // cents
      metadata: { credit_pack_id: pack.id, credits: String(pack.credits) },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { credit_pack_id: pack.id, credits: String(pack.credits) },
      after_completion: {
        type: "redirect",
        redirect: { url: redirectUrl },
      },
    });

    results.push({
      packId: pack.id,
      name: pack.name,
      priceEur: pack.priceEur,
      credits: pack.credits,
      paymentLinkUrl: paymentLink.url,
      priceId: price.id,
      productId: product.id,
    });

    console.log(`  ✅ ${paymentLink.url}`);
  }

  // Output as JSON for easy copying
  console.log("\n=== RESULTS ===");
  console.log(JSON.stringify(results, null, 2));

  // Also output a TS constant block
  console.log("\n=== TYPESCRIPT CONSTANTS ===");
  const field = redirectUrl === PROD_REDIRECT_URL ? "stripePaymentLink" : "stripePaymentLinkDev";
  console.log(`// paste as "${field}" into CREDIT_PACKS in src/constants/shopCatalog.ts`);
  console.log("export const STRIPE_PAYMENT_LINKS: Record<string, string> = {");
  for (const r of results) {
    console.log(`  "${r.packId}": "${r.paymentLinkUrl}",`);
  }
  console.log("};");
}

main().catch(console.error);
