import { select } from 'd3-selection';

export class Renderer {
  // A renderer handles drawing to a display element.
  constructor(selector, tileSet, prefs) {
    this.holder = select(selector);
    this.canvas = this.holder.select("canvas")
    this.tileSet = tileSet;
    this.prefs = prefs;
    this.width = +this.canvas.attr("width");
    this.height = +this.canvas.attr("height");
  }


  *visible_tiles(max_ix) {
    // yield the currently visible tiles based on the zoom state
    // and a maximum index passed manually.
    
    const { tileSet } = this;
    // Materialize using a tileset method.
    const all_tiles = tileSet.map(d => d);
    
    for (let tile of all_tiles) {
      if (tile.is_visible(max_ix, this.zoom.current_corners())) {
        yield(tile);
      }
    }
    
  }
  
  bind_zoom(zoom) {
    this.zoom = zoom;
    return this
  }
  
  update_prefs(prefs) {
    Object.assign(this.prefs, prefs)
  }
  
  *initialize() {
    // Asynchronously wait for the basic elements to be done.
    return Promise.all(this._initializations).then(d => {
      this.zoom.restart_timer(5000)
    })
    
  }
}

export class CanvasRenderer extends Renderer {

  
  
}
