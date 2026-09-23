/**
 * The progress chart: one thin line per measure, drawn as inline SVG.
 *
 * Speed and accuracy get a chart each rather than sharing one with two y-scales.
 * A dual-axis chart lets you place the two lines wherever flatters you, which is
 * exactly the wrong property for a number you are trying to be honest with
 * yourself about.
 *
 * No chart library: this is a polyline and two labels, and a dependency here
 * would be the first crack in "no runtime dependencies".
 */

/** One finished session, reduced to what a chart needs. */
export interface Point {
  readonly at: number;
  readonly value: number;
}

export interface TrendOptions {
  /** Names the single series, so no legend box is needed. */
  readonly label: string;
  /** A CSS custom property name, e.g. `--accent`. */
  readonly colorToken: string;
  readonly format: (value: number) => string;
  /** Y range, when the data alone would mislead -- accuracy never starts at zero. */
  readonly domain?: (values: number[]) => readonly [number, number];
}

const WIDTH = 320;
const HEIGHT = 76;
const PAD_X = 4;
const PAD_Y = 8;
const SVG_NS = "http://www.w3.org/2000/svg";

function svg<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

export class TrendChart {
  readonly element: HTMLDivElement;
  private readonly plot: SVGSVGElement;
  private readonly line: SVGPolylineElement;
  private readonly marker: SVGCircleElement;
  private readonly readout: HTMLSpanElement;
  private readonly empty: HTMLParagraphElement;
  private points: Point[] = [];
  private placed: Array<{ x: number; y: number; point: Point }> = [];

  constructor(private readonly options: TrendOptions) {
    const title = document.createElement("h3");
    title.className = "chart-title";
    title.textContent = options.label;

    this.readout = document.createElement("span");
    this.readout.className = "chart-readout";

    const head = document.createElement("div");
    head.className = "chart-head";
    head.append(title, this.readout);

    this.line = svg("polyline");
    this.line.setAttribute("class", "chart-line");
    this.line.setAttribute("fill", "none");
    this.line.setAttribute("stroke", `var(${options.colorToken})`);

    this.marker = svg("circle");
    this.marker.setAttribute("class", "chart-marker");
    this.marker.setAttribute("r", "4");
    this.marker.setAttribute("fill", `var(${options.colorToken})`);

    const baseline = svg("line");
    baseline.setAttribute("class", "chart-baseline");
    baseline.setAttribute("x1", String(PAD_X));
    baseline.setAttribute("x2", String(WIDTH - PAD_X));
    baseline.setAttribute("y1", String(HEIGHT - PAD_Y));
    baseline.setAttribute("y2", String(HEIGHT - PAD_Y));

    this.plot = svg("svg");
    this.plot.setAttribute("class", "chart-plot");
    this.plot.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
    this.plot.setAttribute("role", "img");
    this.plot.append(baseline, this.line, this.marker);

    this.empty = document.createElement("p");
    this.empty.className = "chart-empty";
    this.empty.textContent = "Two sessions draw a line.";

    this.element = document.createElement("div");
    this.element.className = "chart";
    this.element.append(head, this.plot, this.empty);

    // A line chart in a browser is interactive by nature; the readout beside the
    // title is the tooltip, which avoids a floating box on a deliberately quiet
    // screen.
    this.plot.addEventListener("pointermove", (event) => this.hover(event));
    this.plot.addEventListener("pointerleave", () => this.showLatest());
  }

  /** Redraw from a list of sessions, oldest first. */
  update(points: readonly Point[]): void {
    this.points = [...points].sort((a, b) => a.at - b.at);
    const enough = this.points.length >= 2;
    // `hidden` is an HTML attribute; an SVG element needs the style property.
    this.plot.style.display = enough ? "" : "none";
    this.empty.hidden = enough;
    if (!enough) {
      this.readout.textContent = this.points[0] ? this.options.format(this.points[0].value) : "";
      return;
    }

    const values = this.points.map((point) => point.value);
    const [low, high] = this.options.domain?.(values) ?? defaultDomain(values);
    const first = this.points[0]?.at ?? 0;
    const last = this.points[this.points.length - 1]?.at ?? first;
    // A single day of sessions would divide by zero; spread them evenly instead.
    const span = last - first;

    this.placed = this.points.map((point, index) => ({
      x:
        span > 0
          ? PAD_X + ((point.at - first) / span) * (WIDTH - PAD_X * 2)
          : PAD_X + (index / (this.points.length - 1)) * (WIDTH - PAD_X * 2),
      y:
        HEIGHT -
        PAD_Y -
        ((point.value - low) / (high - low || 1)) * (HEIGHT - PAD_Y * 2),
      point,
    }));

    this.line.setAttribute("points", this.placed.map((p) => `${p.x},${p.y}`).join(" "));
    this.plot.setAttribute(
      "aria-label",
      `${this.options.label} over ${this.points.length} sessions, latest ${this.options.format(
        values[values.length - 1] ?? 0,
      )}`,
    );
    this.showLatest();
  }

  private showLatest(): void {
    const latest = this.placed[this.placed.length - 1];
    if (latest === undefined) return;
    this.marker.setAttribute("cx", String(latest.x));
    this.marker.setAttribute("cy", String(latest.y));
    this.readout.textContent = this.options.format(latest.point.value);
  }

  private hover(event: PointerEvent): void {
    if (this.placed.length === 0) return;
    const box = this.plot.getBoundingClientRect();
    if (box.width === 0) return;
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = this.placed[0];
    if (nearest === undefined) return;
    for (const candidate of this.placed) {
      if (Math.abs(candidate.x - x) < Math.abs(nearest.x - x)) nearest = candidate;
    }
    this.marker.setAttribute("cx", String(nearest.x));
    this.marker.setAttribute("cy", String(nearest.y));
    const when = new Date(nearest.point.at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    this.readout.textContent = `${this.options.format(nearest.point.value)} · ${when}`;
  }
}

/** Headroom above and below so the line is never pinned to an edge. */
function defaultDomain(values: number[]): readonly [number, number] {
  const high = Math.max(...values);
  const low = Math.min(...values);
  const pad = Math.max((high - low) * 0.15, 1);
  return [Math.max(0, low - pad), high + pad];
}

/** Accuracy lives in the top few percent; a zero baseline would flatten it. */
export function accuracyDomain(values: number[]): readonly [number, number] {
  return [Math.min(0.9, Math.min(...values) - 0.01), 1];
}
