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
    olStyles.styles['point'] =  new ol.style.Style({
        image: new ol.style.Circle({
            radius: 6,
            stroke: new ol.style.Stroke({color: '#000', width: 2}),
            fill: new ol.style.Fill({
                color: 'rgba(0, 0, 255, 1.0)'
              })
          })
        });
    olStyles.styles['polygon'] = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'blue',
            width: 3
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
    olStyles.styles['vehicle'] = new ol.style.Style({
      image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
          src: '/static/xgds_map_server/icons/robot_red_16.png'
        }))
      });
}