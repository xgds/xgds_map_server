//__BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the
//Administrator of the National Aeronautics and Space Administration.
//All rights reserved.

//The xGDS platform is licensed under the Apache License, Version 2.0
//(the "License"); you may not use this file except in compliance with the License.
//You may obtain a copy of the License at
//http://www.apache.org/licenses/LICENSE-2.0.

//Unless required by applicable law or agreed to in writing, software distributed
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
//CONDITIONS OF ANY KIND, either express or implied. See the License for the
//specific language governing permissions and limitations under the License.
//__END_LICENSE__

$(function() {
	app.views = app.views || {};

	app.views.OLEditMapView =  app.views.OLMapView.extend({
		initialize: function(options) {
			app.views.OLMapView.prototype.initialize.call(this);
			app.State.tabsContainer = $('#tabs');
			app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
			this.listenTo(app.vent, 'onLayerLoaded', this.initializeMapEditor);
			this.listenTo(app.vent, 'onLayerLoaded', this.createMapEditorView);
			this.listenTo(app.vent, 'recenterMap', this.updateBbox);
		},
		buildLayersForMap: function() {
			app.views.OLMapView.prototype.buildLayersForMap.call(this);
			this.mapEditorGroup = new ol.layer.Group();
			this.layersForMap.push(this.mapEditorGroup);
		},
		createMapEditorView: function() {
			if (_.isUndefined(this.mapEditorView)){
				this.mapEditorView = new app.views.MapEditorView({
					mapLayerJson: {},
					mapLayerGroup: this.mapEditorGroup,
					map: this.map
				});
				this.updateBbox();
			}
			return this.mapEditorView;
		}, 
		updateBbox: function() {
			if (_.isUndefined(app.mapLayer)){
				return;
			}
			var features = app.mapLayer.get('feature');
			if (_.isUndefined(this.mapEditorView) || _.isUndefined(features) || features.length == 0){
				app.views.OLMapView.prototype.updateBbox.call(this);
			} else {
				this.mapEditorView.fitExtent();
			}
		}

	});

	/*
	 * Views for MapEditor
	 * 
	 */
	app.views.MapEditorView = app.views.MapLayerView.extend({
		initialize: function(options) {
			app.views.MapLayerView.prototype.initialize.call(this, options); // call super
			this.map = this.options.map;

			/* Fires when the editingTools are rendered (ie. 'Add Features') is clicked.
			Gets the active draw type (polygon/point/line) and runs addDrawInteraction to start the interaction with the map. */
			this.listenTo(app.vent, 'editingToolsRendered', function(){
				app.vent.trigger('initializeColorPicker');

				var _this = this;
				var theEl = $('label[name=addType].active');
				_this.typeSelect = $(theEl[0]).attr('data');
				$('label[name=addType]').click(function(event) {
					if (_this.featureAdder) {
						_this.map.removeInteraction(_this.featureAdder);
					}
					_this.typeSelect = $(event.target).attr('data');
					_this.addDrawInteraction(_this.typeSelect);
				});
			});
			this.listenTo(app.vent, 'updateFeaturePosition', this.updateFeaturePosition);
			this.listenTo(app.vent, 'deleteFeatureSuccess', function(killedFeature) {
				this.olFeatures.remove(killedFeature.olFeature);
			});
			this.listenTo(app.vent, 'selectFeature', function(feature){
				feature.trigger('setBasicStyle', olStyles.styles['selected_' + feature.get('type').toLowerCase()]);
			});
			this.listenTo(app.vent, 'activeFeature', function(feature){
				feature.trigger('setBasicStyle', olStyles.styles['active_' + feature.get('type').toLowerCase()]);
			});
			this.listenTo(app.vent, 'deselectFeature', function(feature){
				//Create style from feature's style attribute.
				var color = feature.get('style');
				var style = this.createFeatureStyle(color);

				feature.trigger('setBasicStyle', style);
			});
			this.listenTo(app.vent, 'onLayerLoaded', function() {
				this.constructFeatures();
				this.render();
			});
	        this.listenTo(app.vent, 'mapmode', this.setMode);
	        app.vent.trigger('mapEditorLayerInitialized');
		},
		modeMap: {
				'addFeatures' : 'addFeaturesMode',
				'navigate' : 'navigateMode',
				'reposition' : 'repositionMode'
		},
		setMode: function(modeName) {

			if (this.currentMode) {
				this.currentMode.exit.call(this);
			}
			var mode = _.isObject(modeName) ? modeName : this[this.modeMap[modeName]];
			mode.enter.call(this);
			this.currentMode = mode;
			this.currentModeName = modeName;
			if (modeName != 'navigate'){
				app.vent.trigger('setTabRequested','features');
			}
		},
		createFeaturesLayer: function() {
			this.olFeatures = new ol.Collection();
			this.featuresVector = new ol.source.Vector({
				features: this.olFeatures,
				useSpatialIndex: true,
			});
			this.featuresLayer = new ol.layer.Vector({
				map: this.options.map,
				source: this.featuresVector
			});
			/*
			this.pointFeatures = new ol.Collection();
			this.pointVector = new ol.source.Vector({
			features: this.pointFeatures,
			useSpatialIndex: true,
			});
			this.pointLayer = new ol.layer.Vector({
			map: this.options.map,
			source: this.pointVector,
			style: olStyles.getDefaultStyle()
			}); */

		},
		fitExtent: function() {
			var extent = this.featuresVector.getExtent();
			this.map.getView().fit(extent, this.map.getSize());
		},
		initializeFeaturesJson: function() {
			this.trigger('readyToDraw');
		},
		constructFeatures: function() {
			if (_.isUndefined(app.mapLayer)) {
				return;
			}
			if (_.isUndefined(this.layerGroup)){
				this.layerGroup = new ol.layer.Group({name: app.mapLayer.get('name')});
			};
			var _this = this;
			var unconstructedFeatures = app.mapLayer.get('feature');
			if (!_.isEmpty(unconstructedFeatures)){
				_.each(unconstructedFeatures.models, function(featureObj){
					_this.createFeature(featureObj);
				});
			}
		},
		createBackboneFeatureObj: function(olFeature) {
			// create a new backbone feature object from the user drawings on map.
			var geom = olFeature.getGeometry();
			var type = geom.getType();
			var coords;
			if ((type === "Point") || (type === "LineString")){
				coords = geom.getCoordinates();
			} else {
				coords = geom.getCoordinates().reduce(function(a, b) {
					return a.concat(b);
				});
			}
			var featureObj = new app.models.Feature();
			featureObj.set('type', type);
			featureObj.set('description', " ");
			app.util.transformAndSetCoordinates(type, featureObj, coords);
			var featureName = app.util.generateFeatureName(type);
			featureObj.set('name', featureName);
			featureObj.set('popup', true);
			featureObj.set('visible', true);
			featureObj.set('showLabel', false);
			var mapLayer = app.mapLayer;
			featureObj.set('mapLayer', mapLayer);
			featureObj.set('mapLayerName', mapLayer.get('name'));
			featureObj.set('uuid', new UUID(4).format());
			featureObj.set('style', $('#color-picker').spectrum('get').toHexString());
			featureObj.olFeature =  olFeature;

			console.log(featureObj);

			// featureObj.save( {}, {wait: true,
			//    	success: function () {this.initializeFeatureObjViews(featureObj, type)}});

			this.initializeFeatureObjViews(featureObj, type, true);

			return featureObj;
		},
		createFeature: function(featureObj){
			this.initializeFeatureObjViews(featureObj, featureObj.json['type']);
		},
		initializeFeatureObjViews(featureObj, type, skipAdd=false){
			var newFeatureView = undefined;
			switch (type){
			case 'GroundOverlay':
				newFeatureView = new app.views.GroundOverlayEditView({
					model: featureObj,
					olFeature: featureObj.olFeature,
					layerGroup: this.layerGroup,
					featureJson: featureObj.attributes
				});
				this.drawBelow = true;
				break;
			case 'Polygon':
				newFeatureView = new app.views.PolygonEditView({
					model: featureObj,
					olFeature: featureObj.olFeature,
					layerGroup: this.layerGroup,
					featureJson: featureObj.attributes
				});
				break;
			case 'Point':
				newFeatureView = new app.views.PointEditView({
					model: featureObj,
					olFeature: featureObj.olFeature,
					layerGroup: this.layerGroup,
					featureJson: featureObj.attributes
				});
				break;
			case 'LineString':
				newFeatureView = new app.views.LineStringEditView({
					model: featureObj,
					olFeature: featureObj.olFeature,
					layerGroup: this.layerGroup,
					featureJson: featureObj.attributes
				});
				break;
			} 
			if (!_.isUndefined(newFeatureView)){
				featureObj.olFeature = newFeatureView.getFeature();
				featureObj.olFeature.set('model', featureObj);
				featureObj.olFeature.getGeometry().set('view', newFeatureView);
				featureObj.olFeature.getGeometry().on('change', function(event) {
					var geometry = event.target;
					var view = event.target.get('view');
					view.updateCoordsFromGeometry(geometry);
				});
				/*if (featureJson['type'] == 'Point'){
					this.pointFeatures.push(featureObj.olFeature);
				} else {
					this.olFeatures.push(featureObj.olFeature);
				}*/
				// var last = this.olFeatures.item(this.olFeatures.getLength() - 1);
				// if (last != featureObj.olFeature){
				// 	this.olFeatures.push(featureObj.olFeature);
				// }

				if (!(featureObj.olFeature in this.olFeatures) && !skipAdd) {
					this.olFeatures.push(featureObj.olFeature);
				}

				//Set color of feature
				if (skipAdd == true)
					var color = $('#color-picker').spectrum('get').toHexString();

				else
					var color = featureObj.attributes.style;

				//Sets the starting style for each feature
				this.setFeatureStyle(color, newFeatureView);
				this.features.push(newFeatureView);

			}
		},
		setFeatureStyle: function(color, featureView){
			if (color == null){
				featureView.updateStyle(featureView.basicStyle);
			}

			else{
				var style = this.createFeatureStyle(color);
				featureView.updateStyle(style);
			}
		},
		createFeatureStyle: function(color){
			var style = new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: color,
					width: 3
				}),
				image: new ol.style.Circle({
					radius: 6,
					stroke: new ol.style.Stroke({color: 'white', width: 2}),
					fill: new ol.style.Fill({
						color: color
					})
				})
			});

			return style;
		},
		updateFeaturePosition: function(feature) {
			var olFeature = feature.olFeature;
			if (type == 'Point') {
				var newPoint = new ol.geom.Point(transform(feature.get('point')));
				olFeature.setGeometry(newPoint);
			} else if (type == 'Polygon') {
				var coords = this.feature.get('polygon')
				var newPolygon = new ol.geom.Polygon([coords]).transform(LONG_LAT, DEFAULT_COORD_SYSTEM);
				olFeature.setGeometry(newPolygon);
			} else if (type == 'LineString') {
				var newLineString = new ol.geom.LineString(feature.get('lineString')).transform(LONG_LAT, DEFAULT_COORD_SYSTEM);
				olFeature.setGeometry(newLineString);
			} 

		},
		addDrawInteraction: function(typeSelect) {
			var theFeaturesCollection = this.olFeatures;
			this.featureAdder = new ol.interaction.Draw({
				features: theFeaturesCollection,
				type:  /** @type {ol.geom.GeometryType} */ (typeSelect),
				deleteCondition: function(event) {
					return ol.events.condition.shiftKeyOnly(event) &&
					ol.events.condition.singleClick(event);
				}
			}, this);
			this.featureAdder.on('drawend', function(event) { // finished drawing this feature
				var featureObj = this.createBackboneFeatureObj(event.feature);
				app.vent.trigger('showFeature', featureObj);
			}, this);
			this.map.addInteraction(this.featureAdder);
		},
		addFeaturesMode: {
			// in this mode, user can add features (all other features are locked)
			enter: function() {
				app.State.popupsEnabled = false;
				app.State.disableAddFeature = false;
				if (this.featureAdder) {
					this.map.removeInteraction(this.featureAdder);
				} 
				this.addDrawInteraction(this.typeSelect);
			}, 
			exit: function() {
				this.map.removeInteraction(this.featureAdder);
			}
		},
		navigateMode: {
			// in this mode, user can only navigate around the map (all features are locked)
			enter: function() {
				app.State.popupsEnabled = true;
			}, 
			exit: function() {
				app.State.popupsEnabled = false;
			}
		},
		repositionMode: {
			// in this mode, user can edit any existing features but cannot add a new feature.
			enter: function() {
				//TODO when you enter a map layer editor with no features popups should be disabled by default.
				app.State.popupsEnabled = false;
				if (_.isUndefined(this.repositioner)) {
					this.repositioner = new ol.interaction.Modify({
						features: this.olFeatures,
						deleteCondition: function(event) {
							return ol.events.condition.shiftKeyOnly(event) &&
							ol.events.condition.singleClick(event);
						}
					});

					/*
		    this.pointDeleter = new ol.interaction.Select({
			layers: [this.pointLayer], 
			addCondition: function(event) {
			    return ol.events.condition.shiftKeyOnly(event)
			    && ol.events.condition.singleClick(event);
			}
		    });

		    this.pointDeleter.getFeatures().on('add', function(e) {
			var geometry = e.element.get('geometry');
			var type = geometry.getType();
			if (type == "Point") {
			    var model = e.element.get('model');
			    app.vent.trigger('deleteFeature', model);
			}
		    }, this);

		    this.listenTo(app.vent, 'deleteFeatureSuccess', function(killedFeature) {
                        if (!_.isUndefined(killedFeature)){
                            var feature = killedFeature.olFeature;
                            if (!_.isUndefined(feature)){
//                        	this.pointDeleter.getFeatures().remove(feature);
                                var killed = this.pointFeatures.remove(feature);
                                if (killed != undefined){
                                    this.pointDeleter.getFeatures().remove(feature);
                                    this.pointVector.changed();
                                } else {
                                    this.olFeatures.remove(feature);
                                } 
                            }
                        }
                    }, this);
					 */
				} 
				this.map.addInteraction(this.repositioner);
//				this.map.addInteraction(this.pointDeleter);

			}, //end enter
			exit: function() {
				this.map.removeInteraction(this.repositioner);
//				this.map.removeInteraction(this.pointDeleter);
			}
		} // end repositionMode
	});

	app.views.PolygonEditView = app.views.PolygonView.extend({
		initialize: function(options){
			app.views.PolygonView.prototype.initialize.call(this, options);
			this.listenTo(this.model, 'change:coordinates', function() {this.updateGeometryFromCoords()});
			this.model.on('setBasicStyle', function(basicStyle) {
				this.updateStyle(basicStyle);
			}, this);
		},
		render: function() {
			//no op
		},
		updateGeometryFromCoords: function(){
			var coords = this.model.get('polygon');
			var xcoords = transformList(coords);
			var geom = this.olFeature.getGeometry();
			//TODO this ought to have changed the openlayers geometry but does not seem to.
			geom.setCoordinates([xcoords], 'XY');
			this.olFeature.changed();
		},
		updateCoordsFromGeometry: function(geometry) {
			var coords = inverseList(geometry.getCoordinates().reduce(function(a, b) {
				return a.concat(b);
			}));
			var oldCoords = this.model.get('polygon');
			if (!$.arrayEquals(coords, oldCoords)){
				// make sure first and last are the same, figure out which one changed
				if (coords[0] != coords[coords.length - 1]){
					if (coords[0] != oldCoords[0] ) {
						coords[coords.length-1] = coords[0];
					}
				}
				this.model.set('polygon',coords);
				this.model.trigger('coordsChanged');
				this.model.save();
			}
		}
	});

	app.views.PointEditView = app.views.PointView.extend({
		initialize: function(options){
			app.views.PointView.prototype.initialize.call(this, options);
			this.listenTo(this.model, 'change:coordinates', function() {this.updateGeometryFromCoords()});
			this.model.on('setBasicStyle', function(basicStyle) {
				this.updateStyle(basicStyle);
			}, this);

		},
		render: function() {
			// no op
		},
		updateGeometryFromCoords: function(){
			var coords = this.model.get('point');
			var xcoords = transform(coords);
			//TODO this ought to have changed the openlayers geometry but does not seem to.
			this.olFeature.getGeometry().setCoordinates(xcoords);
			this.olFeature.changed();
		},
		updateCoordsFromGeometry: function(geometry) {
			var coords = inverseTransform(geometry.getCoordinates());
			if (!$.arrayEquals(coords, this.model.get('point'))){
				this.model.set('point',coords);
				this.model.trigger('coordsChanged');
				this.model.save();
			}
		}, 
		destroy: function() {
			this.model.destroy({
				data: { 'uuid': this.model.uuid },
				success: function(model, response) {
					if(!_.isUndefined(this.model.collection)) {
						this.model.collection.remove(feature);
					}
				}, 
				error: function() {
					console.log("Error in deleting a feature");
				}
			});
		}
	});

	app.views.LineStringEditView = app.views.LineStringView.extend({
		initialize: function(options){
			app.views.LineStringView.prototype.initialize.call(this, options);
			this.listenTo(this.model, 'change:coordinates', function() {this.updateGeometryFromCoords()});
			this.model.on('setBasicStyle', function(basicStyle) {
				this.updateStyle(basicStyle);
			}, this);

		},
		render: function() {
			// no op
		},
		updateGeometryFromCoords: function(){
			var coords = this.model.get('lineString');
			var xcoords = transformList(coords);
			//TODO this ought to have changed the openlayers geometry but does not seem to.
			this.olFeature.getGeometry().setCoordinates(xcoords,'XY');
			this.olFeature.changed();
		},
		updateCoordsFromGeometry: function(geometry) {
			/*var coords = inverseList(geometry.getCoordinates().reduce(function(a, b) {
		return a.concat(b);
	    })); */
			var coords = inverseList(geometry.getCoordinates());
			if (!$.arrayEquals(coords, this.model.get('lineString'))){
				this.model.set('lineString',coords);
				this.model.trigger('coordsChanged');
				this.model.save();
			}
		}
	});

	app.views.GroundOverlayEditView = app.views.GroundOverlayView.extend({
		initialize: function(options){
			app.views.GroundOverlayView.prototype.initialize.call(this, options);
			this.listenTo(this.model, 'change:coordinates', function() {this.updateGeometryFromCoords()});
			this.model.on('setBasicStyle', function(basicStyle) {
				this.updateStyle(basicStyle);
			}, this);

		},
		render: function() {
			//no op
		},
		updateGeometryFromCoords: function(){
			var coords = this.model.get('polygon');
			var xcoords = transformList(coords);
			var geom = this.olFeature.getGeometry();
			geom.setCoordinates([xcoords],'XY');
			this.olFeature.changed();
		},
		updateCoordsFromGeometry: function(geometry) {
			var coords = inverseList(geometry.getCoordinates().reduce(function(a, b) {
				return a.concat(b);
			}));
			this.model.set('polygon',coords);
			this.model.trigger('coordsChanged');
			this.model.save();
		}
	});

});


