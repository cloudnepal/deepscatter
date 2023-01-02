import { GeoJsonObject } from 'geojson';
import { Renderer } from './rendering';
import { RBush3D } from 'rbush-3d';
import Scatterplot from './deepscatter';
import { Timer, timer } from 'd3-timer';
//import { Data } from 'apache-arrow';

function pixel_ratio(scatterplot: Scatterplot): number {
  // pixelspace
  const [px1, px2] = scatterplot._zoom.scales().x.range();
  // dataspace
  const [dx1, dx2] = scatterplot._zoom.scales().x.domain();

  const ratio = (px2 - px1) / (dx2 - dx1);
  return ratio;
}

export class LabelMaker extends Renderer {
  public layers: GeoJsonObject[] = [];
  public ctx: CanvasRenderingContext2D;
  public tree: DepthTree;
  public timer?: Timer;
  public label_key: string;

  constructor(selector: string, scatterplot: Scatterplot) {
    super(scatterplot.div.node(), scatterplot._root, scatterplot);
    this.canvas = scatterplot.elements[2].selectAll('canvas').node();
    if (this.canvas === undefined) {
      throw new Error('WTF?');
    }
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

    this.tree = new DepthTree(
      this.ctx,
      pixel_ratio(scatterplot),
      0.5,
      [1, 1e6]
    );

    /*    this.tree.accessor = (x, y) => {
      const f = scatterplot._zoom.scales();
      return [f.x(x), f.y(y)];
    };*/
    this.bind_zoom(scatterplot._renderer.zoom);
  }

  start(ticks: number = 1e6) {
    // Render for a set number of ticks. Probably overkill.
    if (this.timer) {
      this.timer.stop();
    }

    this.timer = timer(() => {
      this.render();
      ticks -= 1;
      if (ticks <= 0) {
        this.stop();
      }
    });
  }

  stop() {
    if (this.timer) {
      this.timer.stop();
      this.ctx.clearRect(0, 0, 4096, 4096);
      this.timer = undefined;
    }
  }

  public update(
    featureset: GeoJSON.FeatureCollection,
    label_key: string,
    size_key: string
    //    color_key
  ) {
    // Insert an entire feature collection all at once.
    this.label_key = label_key;
    for (const feature of featureset.features) {
      const { properties, geometry } = feature;
      if (geometry.type === 'Point') {
        // The size can be specified; if not, it defaults to 16pt.
        const size = (properties![size_key] as number) ?? 16;
        let label = '';
        if (
          properties[label_key] !== undefined &&
          properties[label_key] !== null
        ) {
          label = properties[label_key];
        }
        const p: RawPoint = {
          x: geometry.coordinates[0] + Math.random() * 0.1,
          y: geometry.coordinates[1] + Math.random() * 0.1,
          text: label,
          height: size,
        };
        // bulk insert not supported
        this.tree.insert_point(p);
      }
    }
  }

  render() {
    const context = this.ctx;
    const { x_, y_ } = this.zoom.scales();
    const { transform } = this.zoom;
    const { width, height } = this;

    context.clearRect(0, 0, width, height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.globalAlpha = 1;

    const size_adjust = 1; //transform!.k; //Math.exp(Math.log(transform.k) * .5)
    const corners = this.zoom.current_corners()!;
    const overlaps = this.tree.search({
      minX: corners.x[0],
      minY: corners.y[0],
      minZ: transform.k,
      maxX: corners.x[1],
      maxY: corners.y[1],
      maxZ: transform.k,
    });
    //    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.clearRect(0, 0, 4096, 4096);
    const dim = this.scatterplot.dim('color');
    for (const d of overlaps) {
      const { data: datum } = d;
      context.font = `${datum.height * size_adjust}pt verdana`;
      const x = x_(datum.x) as number;
      const y = y_(datum.y) as number;

      context.globalAlpha = 1;
      context.fillStyle = 'white';
      if (dim.field === this.label_key) {
        context.shadowColor = dim.scale(datum.text);
        context.strokeStyle = dim.scale(datum.text);
      } else {
        context.shadowColor = 'black';
      }
      context.shadowBlur = 19;
      context.lineWidth = 3;
      context.strokeText(datum.text, x, y);
      context.shadowBlur = 0;

      context.lineWidth = 4;
      context.fillStyle = 'white';
      context.fillText(datum.text, x, y);
      /*      context.strokeStyle = 'red';
      context.strokeRect(
        x - (datum.pixel_width / 2) * this.tree.pixel_ratio,
        y - (datum.pixel_height / 2) * this.tree.pixel_ratio,
        datum.pixel_width * this.tree.pixel_ratio,
        datum.pixel_height * this.tree.pixel_ratio
      ); */
    }
  }
}

// Stuff the user must pass.
type RawPoint = {
  x: number; // in data space
  y: number; // in data space
  text: string;
  // The pixel heights of the point.
  height: number; // pixel space
};

// Stuff we calculate
type Point = RawPoint & {
  pixel_width: number;
  pixel_height: number;
};

// Cast into 3d space as a rectangle.
type P3d = {
  minX: number; // in data space
  maxX: number; // in data space
  minY: number; // in data space
  maxY: number; // in data space
  minZ: number; // in data space
  maxZ: number; // in data space
  data: Point;
};

let context: null | CanvasRenderingContext2D = null;

function getContext(): CanvasRenderingContext2D {
  if (context !== null) {
    return context;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 400;

  // Get the drawing context
  context = canvas.getContext('2d') as CanvasRenderingContext2D;
  return context;
}

function measure_text(d: RawPoint, pixel_ratio: number, margin = 1) {
  // Uses a global context that it calls into existence for measuring; using the deepscatter
  // canvas gets too confused with state information.

  const context = getContext();
  // Called for the side-effect of setting `d.aspect_ratio` on the passed item.
  context.font = `${d.height}pt verdana`;
  if (d.text === '') {
    return null;
  }
  const ms = context.measureText(d.text);
  let {
    actualBoundingBoxLeft,
    actualBoundingBoxRight,
    actualBoundingBoxAscent,
    actualBoundingBoxDescent,
  } = ms;
  if (
    Number.isNaN(actualBoundingBoxLeft) ||
    actualBoundingBoxLeft === undefined
  ) {
    // Some browsers don't support the full standard.
    actualBoundingBoxLeft = 0;
    actualBoundingBoxRight = ms.width;
    // Hard coded at 6px
    actualBoundingBoxAscent = d.height;
    actualBoundingBoxDescent = 0;
  }

  return {
    pixel_height:
      (actualBoundingBoxAscent - actualBoundingBoxDescent) / pixel_ratio +
      margin / pixel_ratio,
    pixel_width:
      (actualBoundingBoxRight - actualBoundingBoxLeft) / pixel_ratio +
      margin / pixel_ratio,
  };
}

class DepthTree extends RBush3D {
  public scale_factor: number;
  public mindepth: number;
  public maxdepth: number;
  public context: CanvasRenderingContext2D;
  public pixel_ratio: number;
  public rectangle_buffer: number;
  //  public insertion_log = [];
  private _accessor: (p: Point) => [number, number] = (p) => [p.x, p.y];

  /*
  dataSpaceWidth: at zoom level one, how many screen pixels does one x, y unit occupy?
  */

  constructor(
    context: CanvasRenderingContext2D,
    pixel_ratio: number,
    scale_factor = 0.5,
    zoom = [0.1, 1000],
    margin = 10 // in screen pixels
  ) {
    // scale factor used to determine how quickly points scale.
    // Not implemented.
    // size = exp(log(k) * scale_factor);

    super();
    this.scale_factor = scale_factor;
    this.mindepth = zoom[0];
    this.maxdepth = zoom[1];
    this.context = context;
    this.pixel_ratio = pixel_ratio;
    this.margin = margin;
  }

  /**
   *
   * @param p1 a point
   * @param p2 another point
   * @returns The lowest zoom level at which the two points collide
   */
  max_collision_depth(p1: Point, p2: Point) {
    const [x1, y1] = this._accessor(p1);
    const [x2, y2] = this._accessor(p2);
    // The zoom factor after which two points do not collide with each other.

    // First x
    const xdiff = Math.abs(x1 - x2);
    const xoverlap = (p1.pixel_width + p2.pixel_width) / 2;
    const width_overlap = xoverlap / xdiff;

    const ydiff = Math.abs(y1 - y2);
    const yoverlap = (p1.pixel_height + p2.pixel_height) / 2;
    const height_overlap = yoverlap / ydiff;
    // Then y
    const max_overlap = Math.min(width_overlap, height_overlap);
    return max_overlap;
  }

  set accessor(f) {
    this._accessor = f;
  }

  get accessor() {
    return this._accessor;
  }

  to3d(point: Point, zoom = 1, maxZ: number | undefined) {
    // Each point should have a center, an aspect ratio, and a height.

    // The height is the pixel height at a zoom level of one.
    const [x, y] = this.accessor(point);
    const { pixel_height, pixel_width } = point;
    const p: P3d = {
      minX: x - pixel_width / zoom / 2,
      maxX: x + pixel_width / zoom / 2,
      minY: y - pixel_height / zoom / 2,
      maxY: y + pixel_height / zoom / 2,
      minZ: zoom,
      maxZ: maxZ || this.maxdepth,
      data: {
        ...point,
      },
    };

    if (Number.isNaN(x) || Number.isNaN(y))
      throw 'Missing position' + JSON.stringify(point);
    if (Number.isNaN(pixel_width))
      throw 'Missing Aspect Ratio' + JSON.stringify(point);

    return p;
  }

  insert_point(point: RawPoint | Point, mindepth = 1) {
    let measured: Point;
    if (point['pixel_width'] === undefined) {
      measured = {
        ...point,
        ...measure_text(point, this.pixel_ratio, this.margin),
      };
    } else {
      measured = point;
    }
    const p3d = this.to3d(measured, mindepth, this.maxdepth);
    if (!this.collides(p3d)) {
      if (mindepth <= this.mindepth) {
        // It's visible from the minimum depth.
        //        p3d.visible_from = mindepth;
        //        this.insertion_log.push(p3d.maxX, p3d.minX, p3d.minZ, p3d.data.text);
        this.insert(p3d);
      } else {
        // If we can't find any colliders, try inserting it twice as high up.
        // Recursive, so probably expensive.
        this.insert_point(point, mindepth / 2);
      }
    } else {
      this.insert_after_collisions(p3d);
    }
  }

  insert_after_collisions(p3d: P3d) {
    // The depth until which we're hidden; from min_depth (.1 ish) to max_depth(100 ish)
    let hidden_until = -1;
    // The node hiding this one.
    let hidden_by;
    for (const overlapper of this.search(p3d)) {
      // Find the most closely overlapping 3d block.
      // Although the other ones will retain 3d blocks'
      // that extend all the way down to the
      // bottom of the depth tree and so collide with this,
      // it's guaranteed that their *data*
      // will not. And it means we can avoid unnecessary trees.

      const blocked_until = this.max_collision_depth(p3d.data, overlapper.data);

      if (blocked_until > hidden_until) {
        hidden_until = blocked_until;
        hidden_by = overlapper;
      }
    }

    if (hidden_by && hidden_until < this.maxdepth) {
      const hid_data = hidden_by.data;
      const hid_start = hidden_by.minZ;
      const hid_end = hidden_by.maxZ;
      // Down from here.
      // Up until this point.
      if (hid_start < hidden_until) {
        // Split is only required if the thing is actually visible at the level where
        // they diverge.
        this.remove(hidden_by);
        const upper_rect = this.to3d(hid_data, hid_start, hidden_until);
        this.insert(upper_rect);
        const lower_rect = this.to3d(hid_data, hidden_until, hid_end);
        this.insert(lower_rect);
      }
      // Insert the new point
      const current_rect = this.to3d(p3d.data, hidden_until, this.maxdepth);
      this.insert(current_rect);
      //      revised_3d.visible_from = hidden_until;
    }
  }
}
