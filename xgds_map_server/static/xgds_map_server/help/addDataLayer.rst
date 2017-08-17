Building a map overlay with a data layer
----------------------------------------

If you have a scalar map data overlay (e.g. slope, temperature, depth or altitude at each location on the map), you can build a false color map layer that will also show the data value numerically below the map when you hover the mouse on the map.

Required data products and conditions
-------------------------------------

- A properly registered GeoTIFF file with the "raw" data (e.g. each pixel is a 32 bit float value representing surface temperature)

- The GeoTIFF file should be in the same projection as the base layer in the xGDS map (Polar Stereographic for RP, usually WGS84 for Earth)

Data Preparation
----------------
1. Run gdalinfo on the data file to get image statistics

.. code-block:: bash

  gdalinfo -stats np_weh_adapt.map.npolar.tif 
  Band 1 Block=240x8 Type=Float32, ColorInterp=Gray
    Minimum=0.000, Maximum=0.178, Mean=0.067, StdDev=0.025
    Metadata:
      STATISTICS_MAXIMUM=0.1782373636961
      STATISTICS_MEAN=0.067076474228675
      STATISTICS_MINIMUM=0.00028198334621266
      STATISTICS_STDDEV=0.025128417723993

2. Generate a false color image from the data file using the color-relief option of gdaldem:
   Refer to the `gdaldem documentation <http://www.gdal.org/gdaldem.html#gdaldem_color_relief>`_, and examples of `standard colortables <http://trac.osgeo.org/grass/browser/grass/branches/releasebranch_6_4/lib/gis/colors?order=name>`_ from GRASS.

.. code-block:: bash

  gdaldem color-relief ./np_weh_adapt.map.npolar.tif ./BGRYColorTable.txt ./np_weh_adapt.map.npolar.colorized.tif
  0...10...20...30...40...50...60...70...80...90...100 - done.

3. Convert the original floating point TIFF data image to an 8 bit grayscale PNG. For now this is the format that we expect for data values.  You can use Python Imaging Library (Pillow) or MATLAB to do this.  This example uses Python.

.. code-block:: python

  from PIL import Image
  from PIL import ImageMath
  rawMap = Image.open("np_weh_adapt.map.npolar.tif")

  # Compute the scale factor for floating point to 8 bit conversion using the
  # image statistics from gdalinfo (see above)
  scaleFactor = 255.0/0.18
  scaleFactor
    1416.6666666666667

  # Build a floating point scaled grayscale image with pixel values from 0-255
  # Note that ImageMath.eval does not accept symbols (like scaleFactor)
  # defined outside its 1st argument, so we recompute the scale factor there.
  wehGrayFloat = ImageMath.eval("(255.0/0.18)*a", a=rawMap)

  # Convert the floating point image to 8 bit grayscale and save it.
  wehGray8Bit = ImageMath.eval("convert(a,'L')", a=wehGrayFloat)
  wehGray8Bit.save("np_weh_adapt.map.npolar.8bit.png")

4. Create a data legend for the map layer.  The legend must be a 40x240 PNG image and needs to be generated manually.  Hopefully we can improve on that in the future.  An example file is `here <https://rp.xgds.org/data/xgds_map_server/mapData/weh_legend.png>`_.

5. Upload the finished products to xGDS:

  - Go to the `xGDS Map Data Tile Upload page <https://rp.xgds.org/xgds_map_server/addMapDataTile>`_.  Upload the false color GeoTIFF, the 8 bit PNG scaled data image and the legend in the appropriate fields.
  - Leave the *Resampling Method* set to "Lanczos" if you want the image tiles to be smoothed when they are resampled. Change to "Nearest Neighbor" if you don't.
  - The JsFunction field is where you convert from the 8 bit scaled data values back to your original units.  You are provided one argument named *value* with the current pixel value and need to return a scaled value.  In this example, we just need to divide by the *scaleFactor* computed above, so JsFunction is:

.. code-block:: js

  return value/1416.67;
