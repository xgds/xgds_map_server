getInitialLayers = function() {
	return [new ol.layer.Tile({
                     source: new ol.source.MapQuest({layer: 'osm'})
                 })]
}