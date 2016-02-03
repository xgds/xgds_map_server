var olStyles = olStyles || {};

olStyles.getDefaultStyle = function() {
	olStyles.buildStyles();
	return olStyles.styles['default'];
}

olStyles.buildStyles = function() {
    if (_.isUndefined(olStyles.styles)){
        olStyles.styles = new Object();
    } else { // if defined, don't do anything.
    	return;
    }
//    styles['#msn_ylw-pushpin2'] = new ol.style.Style({
//        image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
//            anchor: [0.5, 46],
//            anchorXUnits: 'fraction',
//            anchorYUnits: 'pixels',
//            opacity: 0.75,
//            scale: 0.5,
//            src: '/static/xgds_map_server/icons/ylw-pushpin.png'
//          }))
//        });
 // hardcode some styles for now
    olStyles.styles['default'] = new ol.style.Style({
	    fill: new ol.style.Fill({
		      color: 'rgba(255, 255, 255, 0.2)'
		    }),
		    stroke: new ol.style.Stroke({
		      color: '#ffcc33',
		      width: 2
		    }),
		    image: new ol.style.Circle({
		      radius: 7,
		      fill: new ol.style.Fill({
		        color: '#ffcc33'
		      })
		    })
		  });
    olStyles.styles['selected_point'] =  new ol.style.Style({
        image: new ol.style.Circle({
            radius: 6,
            stroke: new ol.style.Stroke({color: 'cyan', width: 3}),
            fill: new ol.style.Fill({
                color: 'rgba(0, 255, 255, 1.0)'
              })
          })
        });
    olStyles.styles['active_point'] =  new ol.style.Style({
        image: new ol.style.Circle({
            radius: 6,
            stroke: new ol.style.Stroke({color: 'white', width: 3}),
            fill: new ol.style.Fill({
                color: 'rgba(255, 0, 0, 1.0)'
              })
          })
          
        });
    olStyles.styles['point'] =  new ol.style.Style({
        image: new ol.style.Circle({
            radius: 6,
            stroke: new ol.style.Stroke({color: 'white', width: 2}),
            fill: new ol.style.Fill({
                color: 'rgba(0, 0, 255, 1.0)'
              })
          })
        });
    olStyles.styles['selected_polygon'] = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'cyan',
            width: 3
          })
        });
    olStyles.styles['active_polygon'] = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'red',
            width: 4
          }),
          fill: new ol.style.Fill({
            color: 'rgba(255, 0, 0, 0.2)'
          })
        });
    olStyles.styles['polygon'] = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'blue',
            width: 3
          })
        });
    olStyles.styles['selected_linestring'] = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'cyan',
            width: 3
          })
        });
    olStyles.styles['active_linestring'] = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'red',
            width: 4
          })
        });
    olStyles.styles['linestring'] = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'blue',
            width: 3
          })
        });
    olStyles.styles['groundOverlay'] =  new ol.style.Style({
        zIndex: Infinity
    });
    olStyles.styles['label'] = {
            font: '14px Calibri,sans-serif',
            fill: new ol.style.Fill({
                color: 'yellow'
            }),
            stroke: new ol.style.Stroke({
                color: 'black',
                width: 2
            }),
            offsetY: -20
    };
}