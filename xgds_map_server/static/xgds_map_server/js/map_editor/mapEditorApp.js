//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

/*
** Override the TemplateCache function responsible for
** rendering templates so that it will use Handlebars.
*/
Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(
    rawTemplate) {
    return Handlebars.compile(rawTemplate);
};

/*
** Main Application object
*/
var app = (function($, _, Backbone) {
    app = new Backbone.Marionette.Application();

    app.dirty = false;
    app.addRegion('toolbar', '#toolbar');
    app.addRegion('tabs', '#tabs');
    app.addRegion('editingTools', '#editingTools');

    app.module('State', function(options) {
        this.addInitializer(function(options) {
        	this.featureSelected = undefined;
            this.metaExpanded = undefined;
            this.mouseDownLocation = undefined;
            this.pageInnerWidth = undefined;
            this.tabsLeftMargin = undefined;
            this.pageContainer = undefined;
            this.tabsContainer = undefined;
            this.mapResized = false;
            this.mapHeightSet = false;
            this.siteFrameMode = false;
            this.tree = undefined;
            this.treeData = null;
            this.disableAddFeature = false;
            this.popupsEnabled = true;
        });
    });

    app.module('Actions', function(options) {
        this.addInitializer(function(options) {
            this.undoStack = new Array();
            this.redoStack = new Array();
            this.currentState = undefined;
            this.enabled = true;
            this._disableCount = 0;
            this._inAction = false;
            app.vent.trigger('undoEmpty');
            app.vent.trigger('redoEmpty');
        });

        this._enterAction = function() {
            this._inAction = true;
        };

        this._exitAction = function() {
            this._inAction = false;
        };

        this.disable = function() {
            if (this._inAction)
                return;
            this._enterAction();
            this._disableCount += 1;
            this.enabled = false;
            this._exitAction();
        };

        this.enable = function() {
            if (this._inAction)
                return;
            this._enterAction();
            this._disableCount -= 1;
            if (this._disableCount <= 0) {
                this.enabled = true;
                this._disableCount = 0;
            }
            this._exitAction();
        };

        this.undoEmpty = function() {
            return this.undoStack.length == 0;
        };

        this.redoEmpty = function() {
            return this.redoStack.length == 0;
        };

        this.setInitial = function() {
            if (this.currentState == undefined) {
                this.currentState = JSON.stringify(app.currentPlan.toJSON());
            }
        };

        this.resetCurrent = function() {
            if (this._inAction)
                return;
            this._enterAction();
            this.currentState = JSON.stringify(app.currentPlan.toJSON());
            this._exitAction();
        };

        this.action = function() {
            if (this._inAction)
                return;
            if (!this.enabled)
                return;
            if (this.currentState == undefined)
                return;
            this.disable();
            this._enterAction();
            this._exitAction();
            this.enable();
        };

        this.undo = function() {
            if (this._inAction)
                return;
            if (!this.enabled)
                return;
            this.disable();
            this._enterAction();
            this._exitAction();
            this.enable();
        };

        this.redo = function() {
            if (this._inAction)
                return;
            if (!this.enabled)
                return;
            this.disable();
            this._enterAction();
            this._exitAction();
            this.enable();
        };

    });

    app.addInitializer(function(options) {
        var pageTopHeight = $('#page-top').outerHeight();
        var pageElement = $('#page');
        var pageContentElement = $('#page-content');
        pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
        $(window).bind('resize', function() {
            pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
        });
    });

    app.addInitializer(function(options) {
        this.options = options = _.defaults(options || {}, {
        });

        // create the map layer from map layer obj passed in from server as json
        app.mapLayer = new app.models.MapLayer(app.options.mapLayerDict);
        
        // create backbone feature objects already existing in mapLayer's attributes
		$.each(app.mapLayer.attributes.features, function(index, featureJson) {
			var featureObj = new app.models.Feature(featureJson);
			featureObj.json = featureJson;
			featureObj.set('mapLayer', app.mapLayer);  // set up the relationship.
			featureObj.set('mapLayerName', app.mapLayer.get('name'));
			featureObj.set('uuid', featureJson.uuid);
		});
		
        app.map = new app.views.OLEditMapView({
            el: '#map'
        });
        app.vent.trigger('onMapSetup');
        app.toolbar.show(new app.views.ToolbarView());
        app.tabs.show(new app.views.TabNavView());
		app.vent.trigger('clearSaveStatus');
		if (app.mapLayer.attributes.features.length == 0){
		    app.vent.trigger('mapmode', 'addFeatures');
		} else {
		    app.vent.trigger('mapmode', 'navigate');;
		}
    });
    
    app.router = new Backbone.Router({
        routes: {
        	'layers' : 'layers',
        	'info' : 'info',
        	'features': 'features'
        }
    });

    /*
    ** Debug global event triggering.
    */
    app.router.on('all', function(eventname) {
//        console.log('Router event: ' + eventname);
    });

    app.vent.on('all', function(eventname, args) {
    	
    });
    
    app.addInitializer(_.bind(Backbone.history.start, Backbone.history));

    /*
     * Application-level Request & Respond services
     */

    app.hasHandler = function(name) {
        return !!this.reqres._wreqrHandlers[name];
    };

    // Return the color mapped to a given key.
    // If no color has been assigned to that key, allocate one to be forever associated with it.
    app.reqres.setHandler('getColor', function(key) {
        var color;
        function allocateColor() {
            return app.util.randomColor();
        } //TODO: replace this with something that draws from a list of non-horrible colors
        if (!app.colors) {
            app.colors = {};
        }
        if (_.has(app.colors, key)) {
            color = app.colors[key];
        } else {
            color = allocateColor();
            app.colors[key] = color;
        }
        return color;
    });

    /*
    ** Global utility functions
    */
    app.util = {
        indexBy: function(list, keyProp) {
            // Return an object that indexes the objects in a list by their key property.
            // keyProp should be a string.
            obj = {};
            _.each(list, function(item) {
                obj[item[keyProp]] = item;
            });
            return obj;
        },
        deleteFeature: function(feature){
            feature.destroy({
			data: { 'uuid': feature.uuid },
			wait: true,
			success: function(model, response) {
			    if(!_.isUndefined(feature.collection)) {
	    			feature.collection.remove(feature);
	    		    }
			    app.vent.trigger('deleteFeatureSuccess', feature);
			}, 
			error: function() {
				console.log("Error in deleting a feature");
			}
		});
        },
        getFeatureWithName: function(name) {
          var features = app.mapLayer.get('feature').toArray();
          var foundFeature = undefined;
          for (var i=0; i< features.length; i++){
              var feature = features[i];
              if (feature.get('name') == name){
        	  foundFeature = feature;
        	  break;
              }
          }
          return foundFeature;
        },
        generateFeatureName: function(type) {
        	// create a name based type and an index
        	var key = type.substring(0,4);
        	if (type === 'Point'){
        	    key = key + 't';
        	}
        	var suggestion = key + app.util.pad(this.getNextIndex(type), 3, 0);
        	while (this.getFeatureWithName(suggestion) != undefined){
        	    suggestion = key + app.util.pad(this.getNextIndex(type), 3, 0);
        	}
        	return suggestion;
                    
        },
        getNextIndex: function(type){
            if (!app.indicesInitialized){
                this.initializeIndices();
            }
            app.featureIndex[type] = app.featureIndex[type] + 1;
            return app.featureIndex[type];
        },
        initializeIndices: function() {
            var index = 0;
            var features = app.mapLayer.get('feature').toArray();
            app.featureIndex = [];
            app.featureIndex['Polygon'] = 0;
            app.featureIndex['Point'] = 0;
            app.featureIndex['LineString'] = 0;
            app.featureIndex['GroundOverlay'] = 0;
            _.each(features, function(feature) {
        	if (feature != undefined){
                    var type = feature.type;
                    if (_.isUndefined(app.featureIndex[type])){
                        app.featureIndex[type] = 0;
                    } else {
                        app.featureIndex[type] = app.featureIndex[type] + 1;
                    }
        	}
            }); 
            app.indicesInitialized = true;
        },
        getRandomInt: function() {
        	// returns random integer btw 0 and 100
        	return Math.floor((Math.random() * 100) + 1);
        },
        groupBy: function(list, keyProp) {
            obj = {};
            _.each(list, function(item) {
                if (_.isUndefined(obj[item[keyProp]])) {
                    obj[item[keyProp]] = [];
                }
                obj[item[keyProp]].push(item);
            });
            return obj;
        },
        pad: function(n, width, z) { 
        	//pads a number 'width' times with 'z'. i.e. pad(1,4,0) = 0001 
        	z = z || '0';
        	n = n + '';
        	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
        },
        randomColor: function() {
            return '#' + ((1 << 24) * Math.random() | 0).toString(16);
        },
        rainbow: function(numOfSteps, step) {
            // This function generates vibrant, 'evenly spaced' colours (i.e. no clustering).
            // This is ideal for creating easily distiguishable vibrant markers in Google Maps and other apps.
            // Adam Cole, 2011-Sept-14
            // HSV to RBG adapted from:
            // http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
            // source: http://stackoverflow.com/questions/1484506/random-color-generator-in-javascript/7419630
            var r, g, b;
            var h = step / numOfSteps;
            var i = ~~(h * 6);
            var f = h * 6 - i;
            var q = 1 - f;
            switch (i % 6) {
            case 0:
                r = 1, g = f, b = 0;
                break;
            case 1:
                r = q, g = 1, b = 0;
                break;
            case 2:
                r = 0, g = 1, b = f;
                break;
            case 3:
                r = 0, g = q, b = 1;
                break;
            case 4:
                r = f, g = 0, b = 1;
                break;
            case 5:
                r = 1, g = 0, b = q;
                break;
            }
            var c = '#' + ('00' + (~~(r * 255)).toString(16)).slice(-2) +
                ('00' + (~~(g * 255)).toString(16)).slice(-2) +
                ('00' + (~~(b * 255)).toString(16)).slice(-2);
            return (c);
        },
        
        getFeatureCoordinates: function(type, feature) {
        	if (type == 'Point') {
        		return feature.get('point');
        	} else if (type == 'Polygon') {
        		return feature.get('polygon');
        	} else if (type == 'LineString') {
        		return feature.get('lineString');
        	} 
        },
        
        updateFeatureCoordinate: function(type, feature, newX, newY, index) {
        	/*
        	 * newCoords: updated (x,y) in lon lat
        	 * index: index for vertices if is a linestring or a polygon
        	 */
        	if (type == 'Point') {
        		feature.set('point', [newX, newY]);
        	} else if (type == 'Polygon') {
        		var polygon = feature.get('polygon');
        		polygon[index] = [newX, newY];
        		//note: ol polygon coords list both start and end point (which are the same). 
        		// so when start pt changes, update the end point.
        		if (index == 0) {
        			polygon[-1] = [newX, newY];
        		}
        		feature.set('polygon', polygon);
        	} else if (type == 'LineString') {
        		var lineString = feature.get('lineString');
        		lineString[index] = [newX, newY];
        		feature.set('lineString', lineString);
        	} 
        },
        
        transformAndSetCoordinates: function(type, feature, coordinates) {
        	// transform user drawn coordinates from spherical mercator to lon lat
        	var tCoords = null;
        	if (type == "Point") {
    			feature.set("point", inverseTransform(coordinates));
    		} else if (type == "Polygon") {
    			feature.set('polygon', inverseList(coordinates));
    		} else if (type == "LineString") {
                feature.set('lineString', inverseList(coordinates));
    		} else if (type == "GroundOverlay") {
                feature.set('polygon', inverseList(coordinates));
            }
    	},
        
        toSiteFrame: function(coords, alternateCrs) {
            if (alternateCrs.type == 'roversw' &&
                alternateCrs.properties.projection == 'utm') {
                var utmcoords = [null, null, null];
                LLtoUTM(coords[1], coords[0], utmcoords, alternateCrs.properties.zone);
                var x = utmcoords[1] - alternateCrs.properties.originNorthing;
                var y = utmcoords[0] - alternateCrs.properties.originEasting;
                return [x, y]; // northing, easting for roversw
            } else if (alternateCrs.type == 'proj4') {
                var proj = proj4(alternateCrs.properties.projection);
                return proj.forward(coords);
            } else {
                console.warn('Alternate CRS unknown');
                return coords;
            }
        },

        toLngLat: function(coords, alternateCrs) {
            if (alternateCrs.type == 'roversw' &&
                alternateCrs.properties.projection == 'utm') {
                var oeasting = alternateCrs.properties.originEasting;
                var onorthing = alternateCrs.properties.originNorthing;
                var utmEasting = parseFloat(coords[1]) + alternateCrs.properties.originEasting;
                var utmNorthing = parseFloat(coords[0]) + alternateCrs.properties.originNorthing;
                var lonLat = {};
                UTMtoLL(utmNorthing, utmEasting,
                        alternateCrs.properties.zone,
                        lonLat);
                return [lonLat.lon, lonLat.lat];
            } else if (alternateCrs.type == 'proj4') {
                var proj = proj4(alternateCrs.properties.projection);
                return proj.inverseTransform(coords);
            } else {
                console.warn('Alternate CRS unknown');
                return coords;
            }
        }

    };
    
    app.vent.on('deleteFeature', function(feature){
	app.util.deleteFeature(feature);
    });

    return app;

}(jQuery, _, Backbone));
