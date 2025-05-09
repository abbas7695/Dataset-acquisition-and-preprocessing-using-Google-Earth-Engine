// Dataset acquisition and preprocessing using Google Earth Engine for the years 2000, 2005, 2010, 2015 and 2020
var l7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2"),
    l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
    roi = ee.FeatureCollection("projects/ee-scholarhasnain5/assets/Gaza-Strip"); // Import Landsat 7, 8 Dataset and Studay Area

// Cloud mask function for Landsat 8 & 9 (Level 2, Collection 2, Tire 1)
function cloudMask(image){
  var qa = image.select('QA_PIXEL');
  var dilated = 1 << 1;
  var cirrus = 1 << 2;
  var cloud = 1 << 3;
  var shadow = 1 << 4;
  var mask = qa.bitwiseAnd(dilated).eq(0)
    .and(qa.bitwiseAnd(cirrus).eq(0))
    .and(qa.bitwiseAnd(cloud).eq(0))
    .and(qa.bitwiseAnd(shadow).eq(0));
  return image.select(['SR_B.*'], ['B1', 'B2', 'B3', 'B4', 'B5','B6', 'B7'])
    .updateMask(mask)
    .multiply(0.0000275)
    .add(-0.2);
}

// // Cloud mask function for Landsat 5 & 7 (Level 2, Collection 2, Tire 1)
// function cloudMask(image){
//   var qa = image.select('QA_PIXEL');
//   var dilated = 1 << 1;
//   var cirrus = 1 << 2;
//   var cloud = 1 << 3;
//   var shadow = 1 << 4;
//   var mask = qa.bitwiseAnd(dilated).eq(0)
//     .and(qa.bitwiseAnd(cirrus).eq(0))
//     .and(qa.bitwiseAnd(cloud).eq(0))
//     .and(qa.bitwiseAnd(shadow).eq(0));
//   return image.select(['SR_B.*'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B7'])
//     .updateMask(mask)
//     .multiply(0.0000275)
//     .add(-0.2);
// }

// Create an image composite
var image = l8.filterBounds(roi).filterDate('2020-01-01', '2020-12-31')
  // .merge(l7.filterBounds(roi).filterDate('2000-01-01', '2000-12-31'))
  .map(cloudMask)
  .median()
  .clip(roi);

// Pan sharpening
// Convert the RGB bands to the HSV color space.
var hsv = image.select(['SR_B.*'], ['B1', 'B2', 'B3', 'B4', 'B5','B6', 'B7']).rgbToHsv();

// Swap in the panchromatic band and convert back to RGB.
var sharpened = ee.Image.cat([
  hsv.select('hue'), hsv.select('saturation'), image.select('B8')
]).hsvToRgb();

// Visualize
Map.addLayer(image, {min: [0.1, 0.05, 0.05], max: [0.4, 0.3, 0.2], bands: ['B5', 'B4', 'B3']}, 'Image');
Map.centerObject(roi,11);

// Band map for Landsat 8 & 9 (Level 2, Collection 2, Tire 1)
var bandMap = {
  BLUE: image.select('B2'),
  GREEN: image.select('B3'),
  RED: image.select('B4'),
  NIR: image.select('B5'),
  SWIR1: image.select('B6'),
  SWIR2: image.select('B7')
};

// // Band map for Landsat 5 & 7 (Level 2, Collection 2, Tire 1)
// var bandMap = {
//   BLUE: image.select('B1'),
//   GREEN: image.select('B2'),
//   RED: image.select('B3'),
//   NIR: image.select('B4'),
//   SWIR1: image.select('B5'),
//   SWIR2: image.select('B7')
// };

// Add spectral indices
var indices = ee.Image([
  { name: 'BAEI', formula: '(RED+0.3)/(GREEN+SWIR1)'},
  { name: 'IBI', formula: '((2 * SWIR1 / (SWIR1 + NIR)) - ((NIR / (NIR - RED)) + (GREEN / (GREEN + SWIR1)))) / ' + '((2 * SWIR1 / (SWIR1 + NIR)) + ((NIR / (NIR - RED)) + (GREEN / (GREEN + SWIR1))))'},
  { name: 'MBAI', formula: 'NIR+(1.57*GREEN)+(2.4*SWIR1)/(1+NIR)'},
  { name: 'NBI', formula: '(RED-SWIR1)/(NIR)'},
  { name: 'NDBI', formula: '(SWIR1-NIR)/(SWIR1 + NIR)'},
  { name: 'NDBaI', formula: '(SWIR1-SWIR2)/(SWIR1+SWIR2)'},
].map(function(dict){
  var indexImage = image.expression(dict.formula, bandMap).rename(dict.name);
  return indexImage;
}));

// Add spectral indices  to image
image = image.addBands(indices).clip(roi);

// Export image
Export.image.toDrive({
  image: image.toFloat(),
  scale: 15,
  maxPixels: 1e13,
  region: roi,
  crs: 'EPSG:4326',
  folder: 'DL',
  description: 'Gaza-Strip_2020'
});
