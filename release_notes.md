# 2.2.5

Support int32 dates as floats (without null mask for now.)

# 2.2.3

Use of 'x0' and 'y0' positions produce smooth interpolation between two different points.

# 2.2.2

Hopefully fix issue with points of index zero breaking display size rules.

# 2.2.0

Switch to Arrow JS 7.0 backend, requiring substantial rewrite.

# 2.1.1

Restore some jitter types broken by ts conversion.

Remove some extraneous logging.

# 2.1.0

1. Major refactor to use typescript. This requires standardizing some of the approaches to API a bit more, and 
   likely will cause some short-term breakage until all changes are found. Most
   files renamed from `.js` to `.ts`. Not yet passing all typescript checks.

2. Shift texture strategy for lookups to minimize number of samplers; from 16 in the old version to two
   in the new one (one for one-d channels like filters, and the other for color schemes.) Introduces a new 
   class in AestheticSet.ts.

3. Start to build an API independent of the `plotAPI`, especially using Andromeda Yelton's code to programatically
   control the function responses on mouseover and click events. 

4. Some minor shifts in the shader code. I don't anticipate doing any more major webGL features, and instead am
   trying to prepare for a webGPU push that will be version 3.0.

5. Add UMD, IIFE, etc. modules builds.

# 2.0

Complete rewrite. Move from Canvas to WebGL and from csv tile storage to Apache Arrow.

# 1.0

First release.