import { getYardService } from "@/src/services/yard-service";

export default async function Home() {
  const sale = await getYardService().getSale("sale_demo");

  return (
    <main>
      <header>
        <span className="eyebrow">Hackathon workspace ready</span>
        <h1>One photo. A whole garage sale.</h1>
        <p>
          The frontend is currently powered by shared, validated mock contracts. Convex can
          replace the adapter later without changing this UI.
        </p>
      </header>

      <section aria-labelledby="demo-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Mock service</span>
            <h2 id="demo-heading">{sale.title}</h2>
          </div>
          <strong>{sale.items.length} items detected</strong>
        </div>

        <div className="item-grid">
          {sale.items.map((item, index) => (
            <article key={item.id}>
              <div className="item-visual" aria-hidden="true">
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div>
                <small>{item.category}</small>
                <h3>{item.title}</h3>
                <p>₱{item.finalPricePhp?.toLocaleString("en-PH")}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
