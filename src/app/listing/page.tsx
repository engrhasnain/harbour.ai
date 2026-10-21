import { Check, MapPin, Phone } from "lucide-react";
import { AskButton } from "@/components/AskButton";
import { ChatWidget } from "@/components/ChatWidget";
import { Gallery, type Photo } from "@/components/Gallery";
import { BUILDING } from "@/lib/kb";
import { db } from "@/lib/store";
import { monthDay } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bonnie Doon Manor | Apartments for Rent in Bonnie Doon, Edmonton" };

const PHOTOS: Photo[] = [
  { src: "/bdm/exterior.jpg", alt: "Building exterior on 88 Avenue" },
  { src: "/bdm/living-1.jpg", alt: "Living room" },
  { src: "/bdm/kitchen-2.jpg", alt: "Kitchen" },
  { src: "/bdm/bedroom-1.jpg", alt: "Bedroom" },
  { src: "/bdm/dining.jpg", alt: "Dining area" },
  { src: "/bdm/living-2.jpg", alt: "Living room" },
  { src: "/bdm/kitchen-1.jpg", alt: "Galley kitchen" },
  { src: "/bdm/bath-1.jpg", alt: "Bathroom" },
  { src: "/bdm/living-3.jpg", alt: "Living room" },
  { src: "/bdm/kitchen-3.jpg", alt: "Kitchen" },
  { src: "/bdm/living-4.jpg", alt: "Living room" },
  { src: "/bdm/living-5.jpg", alt: "Living room" },
];

const IN_SUITE = ["Renovated kitchen and bathroom", "Plank flooring", "Private balcony", "Fridge and stove", "Heat and water included", "Large windows"];
const IN_BUILDING = ["Controlled-access entry", "Video surveillance", "On-site coin laundry", "Storage", "Assigned surface parking with plug-ins", "Professionally managed"];
const NEARBY = [
  ["Bonnie Doon LRT stop (Valley Line)", "10 min walk"],
  ["Bonnie Doon Centre: Safeway, Shoppers", "12 min walk"],
  ["Campus Saint-Jean", "4 min walk"],
  ["Mill Creek Ravine trails", "Close by"],
  ["Whyte Avenue", "5 min drive"],
  ["University of Alberta", "10 min drive"],
];

export default function ListingPage() {
  const units = db().units.filter((u) => u.status !== "leased");
  const rents = units.map((u) => u.rent);
  const { lat, lon } = BUILDING;
  const bbox = [lon - 0.012, lat - 0.005, lon + 0.012, lat + 0.005].join(",");

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="leading-tight">
            <div className="font-serif text-xl tracking-tight text-[#1f3a5f]">Bonnie Doon Manor</div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500">Edmonton · Bonnie Doon</div>
          </div>
          <nav className="hidden gap-6 text-sm text-slate-600 md:flex">
            <a href="#suites" className="hover:text-slate-900">Suites</a>
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#policies" className="hover:text-slate-900">Fees & policies</a>
            <a href="#location" className="hover:text-slate-900">Location</a>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-sm text-slate-600 sm:flex">
              <Phone size={14} /> {BUILDING.leasingPhone}
            </span>
            <AskButton text="Hi, I'd like to book a viewing." className="rounded-md bg-[#1f3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#18304f]">
              Book a viewing
            </AskButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-6">
        <Gallery photos={PHOTOS} />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_330px]">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Bonnie Doon Manor</h1>
            <div className="mt-1 flex items-center gap-1.5 text-slate-600">
              <MapPin size={15} /> {BUILDING.address}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-y-4 border-y border-slate-200 py-5 sm:grid-cols-4">
              {[
                ["Rent", `$${Math.min(...rents).toLocaleString()} – $${Math.max(...rents).toLocaleString()}`],
                ["Bedrooms", "1 – 2"],
                ["Bathrooms", "1"],
                ["Size", "610 – 820 sq ft"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-slate-500">{k}</div>
                  <div className="font-semibold text-slate-900">{v}</div>
                </div>
              ))}
            </div>

            <section id="suites" className="scroll-mt-20 pt-8">
              <h2 className="text-xl font-semibold text-slate-900">Available suites</h2>
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Suite</th>
                      <th className="px-4 py-2.5 font-medium">Bed / Bath</th>
                      <th className="px-4 py-2.5 font-medium">Size</th>
                      <th className="px-4 py-2.5 font-medium">Rent</th>
                      <th className="px-4 py-2.5 font-medium">Available</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {units.map((u) => {
                      const ready = u.status === "vacant" || !u.availableFrom || new Date(u.availableFrom) <= new Date();
                      return (
                        <tr key={u.id}>
                          <td className="px-4 py-3 font-medium text-slate-900">#{u.number}</td>
                          <td className="px-4 py-3">
                            {u.beds} bed / {u.baths} bath
                          </td>
                          <td className="px-4 py-3">{u.sqft} sq ft</td>
                          <td className="px-4 py-3 font-medium text-slate-900">${u.rent.toLocaleString()}/mo</td>
                          <td className="px-4 py-3">{ready ? <span className="text-emerald-700">Now</span> : monthDay(u.availableFrom!)}</td>
                          <td className="px-4 py-3 text-right">
                            <AskButton text={`Hi, is the ${u.beds} bedroom (#${u.number}) still available? I'd like to see it.`} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50">
                              Request viewing
                            </AskButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="pt-10">
              <h2 className="text-xl font-semibold text-slate-900">About the building</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-slate-700">
                <p>
                  Bonnie Doon Manor is a quiet, 20-suite walk-up on a tree-lined street in Edmonton&apos;s French Quarter. Suites have been renovated with updated kitchens and bathrooms, new plank flooring and fresh paint, and every suite has its own balcony.
                </p>
                <p>
                  Heat and water are included in the rent. The building has controlled entry, video surveillance, on-site laundry and storage, and each suite can have an assigned parking stall with a plug-in for winter. You&apos;re about ten minutes on foot from the Valley Line LRT and Bonnie Doon Centre, with the river valley trails close by.
                </p>
              </div>
            </section>

            <section id="features" className="scroll-mt-20 pt-10">
              <h2 className="text-xl font-semibold text-slate-900">Features</h2>
              <div className="mt-4 grid gap-8 sm:grid-cols-2">
                {[
                  ["In the suite", IN_SUITE],
                  ["In the building", IN_BUILDING],
                ].map(([title, items]) => (
                  <div key={title as string}>
                    <div className="mb-2 text-sm font-semibold text-slate-900">{title as string}</div>
                    <ul className="space-y-2 text-sm text-slate-700">
                      {(items as string[]).map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <Check size={15} className="text-slate-400" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section id="policies" className="scroll-mt-20 pt-10">
              <h2 className="text-xl font-semibold text-slate-900">Fees & policies</h2>
              <dl className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
                {[
                  ["Lease term", "12 months"],
                  ["Security deposit", "$750 – $900"],
                  ["Utilities", "Heat and water included. Tenant pays electricity."],
                  ["Pets", "Cats and dogs welcome. $300 refundable pet deposit, no pet rent."],
                  ["Parking", "Assigned surface stall with plug-in"],
                  ["Smoking", "Non-smoking building"],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[150px_1fr] gap-4 px-4 py-3">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section id="location" className="scroll-mt-20 pt-10">
              <h2 className="text-xl font-semibold text-slate-900">Location</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                <iframe
                  title="Map of Bonnie Doon Manor"
                  className="h-[300px] w-full"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`}
                />
              </div>
              <ul className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {NEARBY.map(([place, dist]) => (
                  <li key={place} className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-700">{place}</span>
                    <span className="text-slate-500">{dist}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-slate-200 p-5 shadow-sm">
              <div className="text-sm text-slate-500">Starting at</div>
              <div className="text-2xl font-semibold text-slate-900">
                ${Math.min(...rents).toLocaleString()}
                <span className="text-base font-normal text-slate-500"> /month</span>
              </div>
              <div className="mt-1 text-sm text-slate-600">{units.length} suites available</div>
              <AskButton text="Hi, I'd like to book a viewing." className="mt-4 w-full rounded-md bg-[#1f3a5f] py-2.5 text-sm font-medium text-white hover:bg-[#18304f]">
                Book a viewing
              </AskButton>
              <AskButton text="Hi, I have a few questions about the suites." className="mt-2 w-full rounded-md border border-slate-300 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
                Send a message
              </AskButton>
              <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Phone size={14} /> {BUILDING.leasingPhone}
                </div>
                <div>Viewings Mon–Fri 10–7, Sat 10–2</div>
              </div>
            </div>
            <p className="mt-3 px-1 text-xs text-slate-500">Professionally managed by Triple Harbour Capital.</p>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-5 py-6 text-xs text-slate-500">
          <span>© 2026 Bonnie Doon Manor · Triple Harbour Capital</span>
          <span>{BUILDING.address}</span>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
