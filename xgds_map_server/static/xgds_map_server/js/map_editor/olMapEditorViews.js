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
			this.listenTo(app.vent, 'actionLayerLoaded', this.createMapEditorView);
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
			//TODO: Change to be its own function
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

					//TODO Move this to an event in mapEditorViews under EditingToolsView
					if (_this.typeSelect === 'Point')
						$('#icon-type').show();

					else
						$('#icon-type').hide();

					_this.addDrawInteraction(_this.typeSelect);
				});
			});
			this.listenTo(app.vent, 'updateFeaturePosition', this.updateFeaturePosition);
			this.listenTo(app.vent, 'deleteFeatureSuccess', function(killedFeature) {
				this.olFeatures.remove(killedFeature.olFeature);
				if (killedFeature.get('type') === "Station"){
					this.stationsDecorators.remove(killedFeature.olToleranceFeature);
					this.stationsDecorators.remove(killedFeature.olBoundaryFeature);
				}
				app.Actions.action();
			});
			this.listenTo(app.vent, 'clearAllFeatures', function(){
				this.olFeatures.clear();
				this.stationsDecorators.clear();
			});
			this.listenTo(app.vent, 'selectStatusChanged', this.setSelectStatusStyle);
			this.listenTo(app.vent, 'onLayerLoaded', function() {
				this.constructFeatures();
				this.render();
			});
			this.listenTo(app.vent, 'actionLayerLoaded', function() {
				this.constructFeatures();
				this.render();
			});
			this.listenTo(app.vent, 'newFeatureLoaded', function(featureObj){
				this.initializeFeatureObjViews(featureObj, featureObj.attributes.type);
			});
			this.listenTo(app.vent, 'setMapBounds', this.setMapBounds);
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
		setSelectStatusStyle: function(feature, op){
			var type = feature.get('type');
			var shape = feature.get('shape');
			var color = null, style = null;

			if (!shape)
				shape = "";

			// Get correct color for each operation
			if (op == "Selected")
				color = "#00ffff";

			else if (op == "Active")
				color = "#ff0000";

			else
				color = feature.get('style');

			var styleName = feature.get('type').toLowerCase() + "_" + color + shape;

			//Don't create new styles if we have already done it before
			if (!this.olStyles[styleName]){
				// Set feature style accordingly
				if (type === "Point")
					style = this.createPointStyle(color, shape);

				else if (type === "Station") {
                    style = this.createStationStyle(color);
                }

				else
					style = this.createFeatureStyle(color);

				this.olStyles[styleName] = style;
			}

			else {
				style = this.olStyles[styleName];
			}

			feature.trigger('setBasicStyle', style);

			if (type === 'Station')
				app.vent.trigger('station' + op, color, feature);

		},
		createFeaturesLayer: function() {
			this.stationsDecorators = new ol.Collection();
			this.stationsDecoratorsLayer = new ol.layer.Vector({
				map: this.options.map,
				source:  new ol.source.Vector({features: this.stationsDecorators}),
				zIndex: 100
			});

			this.olFeatures = new ol.Collection();
			this.featuresVector = new ol.source.Vector({
				features: this.olFeatures,
				useSpatialIndex: true,
			});
			this.featuresLayer = new ol.layer.Vector({
				map: this.options.map,
				source: this.featuresVector,
				zIndex: 200
			});
			this.featuresLayer.setZIndex(150);
		},
		fitExtent: function() {
			var extent = this.featuresVector.getExtent();
			this.map.getView().fit(extent, this.map.getSize());
		},
		setMapBounds: function(){
			// var bounds = this.map.getView().calculateExtent(this.map.getSize());
			var bounds = this.featuresVector.getExtent();
			bounds = ol.proj.transformExtent(bounds, SPHERICAL_MERCATOR, LONG_LAT);

			//Bottom Left Corner of featuresVector
			app.mapLayer.set('minLon', bounds[0]);
			app.mapLayer.set('minLat', bounds[1]);

			//Top Right Corner of featuresVector
			app.mapLayer.set('maxLon', bounds[2]);
			app.mapLayer.set('maxLat', bounds[3]);
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
		createBackboneFeatureObj: function(olFeature, station=false) {
			// Create a new backbone feature object from the user drawings on map.
			var geom = olFeature.getGeometry();

			if (station === true)
				var type = "Station";

			else
				var type = geom.getType();

			var coords = this.getFeatureCoords(type, geom);
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

			if (type === "Point")
				featureObj.set('shape', $('#icon-type').val());

			else if (type === "Station"){
				featureObj.set('boundary', 5);
				featureObj.set('tolerance', 20);
			}

			featureObj.olFeature = olFeature;
			this.initializeFeatureObjViews(featureObj, type, true);

			// Keep jsonFeatures field updated
			app.util.updateJsonFeatures();
			app.Actions.action();

			return featureObj;
		},
		getFeatureCoords: function(type, geom){
			var coords;

			if ((type === "Point") || (type === "LineString") || (type === "Station")){
				coords = geom.getCoordinates();
			} else {
				coords = geom.getCoordinates().reduce(function(a, b) {
					return a.concat(b);
				});
			}

			return coords;
		},
		createFeature: function(featureObj){
			this.initializeFeatureObjViews(featureObj, featureObj.json['type']);
		},
		initializeFeatureObjViews(featureObj, type, isNew=false){
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
				case 'Station':
					newFeatureView = new app.views.StationEditView({
						model: featureObj,
						olFeature: featureObj.olFeature,
						layerGroup: this.layerGroup,
						stationsDecorators: this.stationsDecorators,
						stationsDecoratorsLayer: this.stationsDecoratorsLayer.getSource(),
						featureJson: featureObj.attributes,
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

				if (!(featureObj.olFeature in this.olFeatures) && !isNew) {
					this.olFeatures.push(featureObj.olFeature);
				}

				//Sets style of feature depending on if it is a new feature or a saved one.
				if (isNew == true) {
                    var color = $('#color-picker').spectrum('get').toHexString();
                    app.vent.trigger('appChanged');
                }

				else{
					var color = featureObj.attributes.style;
				}

				this.setFeatureStyle(color, newFeatureView, featureObj.attributes.shape);
				this.drawStationDecorators(newFeatureView, featureObj);

				this.features.push(newFeatureView);
			}
		},
		drawStationDecorators: function(featureView, featureObj){
			if (featureView.featureJson.type === "Station"){
				var toleranceFeature = featureView.getToleranceFeature();
				var boundaryFeature = featureView.getBoundaryFeature();
				featureObj.olToleranceFeature = toleranceFeature;
				featureObj.olBoundaryFeature = boundaryFeature;

				if (!(featureObj.olToleranceFeature in this.stationsDecorators))
					this.stationsDecorators.push(toleranceFeature);

				if (!(featureObj.olBoundaryFeature in this.stationsDecorators))
					this.stationsDecorators.push(boundaryFeature);
			}
		},
		updateFeaturePosition: function(feature) {
			var olFeature = feature.olFeature;
			if (type === 'Point') {
				var newPoint = new ol.geom.Point(transform(feature.get('point')));
				olFeature.setGeometry(newPoint);
			} else if (type === 'Polygon') {
				var coords = this.feature.get('polygon')
				var newPolygon = new ol.geom.Polygon([coords]).transform(LONG_LAT, DEFAULT_COORD_SYSTEM);
				olFeature.setGeometry(newPolygon);
			} else if (type === 'LineString') {
				var newLineString = new ol.geom.LineString(feature.get('lineString')).transform(LONG_LAT, DEFAULT_COORD_SYSTEM);
				olFeature.setGeometry(newLineString);
			} else if (type === 'Station'){
				var newPoint = new ol.geom.Point(transform(feature.get('point')));
				olFeature.setGeometry(newPoint);
			}
		},
		addDrawInteraction: function(typeSelect) {
			var station = false;
			if (typeSelect === "Station"){
				typeSelect = "Point";
				station = true;
            }

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
				var featureObj = this.createBackboneFeatureObj(event.feature, station);
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
					this.repositioner.on('modifyend', function(evt){
						app.util.updateJsonFeatures();
						app.Actions.action();
					});
				} 
				this.map.addInteraction(this.repositioner);
			},
			exit: function() {
				this.map.removeInteraction(this.repositioner);
			}
		}
	});

	app.views.PolygonEditView = app.views.PolygonView.extend({
		initialize: function(options){
			app.views.PolygonView.prototype.initialize.call(this, options);
			this.listenTo(this.model, 'change:coordinates', function() {
				this.updateGeometryFromCoords();
				app.util.updateJsonFeatures();
				app.Actions.action();
			});
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
				app.vent.trigger('appChanged');
			}
		}
	});

	app.views.PointEditView = app.views.PointView.extend({
		initialize: function(options){
			app.views.PointView.prototype.initialize.call(this, options);
			this.listenTo(this.model, 'change:coordinates', function() {
				this.updateGeometryFromCoords();
				app.util.updateJsonFeatures();
				app.Actions.action();
			});
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
				app.vent.trigger('appChanged');
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
			this.listenTo(this.model, 'change:coordinates', function() {
				this.updateGeometryFromCoords();
				app.util.updateJsonFeatures();
				app.Actions.action();
			});
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
				app.vent.trigger('appChanged');
			}
		}
	});

	app.views.StationEditView = app.views.StationView.extend({
		initialize: function(options){
			this.stationsDecoratorsLayer = this.options.stationsDecoratorsLayer;
			this.stationsDecorators = this.options.stationsDecorators;
			app.views.StationView.prototype.initialize.call(this, options);
			this.listenTo(this.model, 'change:coordinates', function() {
				this.updateGeometryFromCoords();
				app.util.updateJsonFeatures();
				app.Actions.action();
			});
			this.listenTo(app.vent, 'changeTolerance', function(){
				this.olToleranceFeature = this.getToleranceFeature();
			});
			this.listenTo(app.vent, 'changeBoundary', function(){
				this.olBoundaryFeature = this.getBoundaryFeature();
			});
			this.listenTo(app.vent, 'stationSelected', function(color, feature){
				feature.olToleranceFeature.setStyle(this.createToleranceStyle(color));
				feature.olBoundaryFeature.setStyle(this.createBoundaryStyle(color));
			});
			this.listenTo(app.vent, 'stationActive', function(color, feature){
				feature.olToleranceFeature.setStyle(this.createToleranceStyle(color));
				feature.olBoundaryFeature.setStyle(this.createBoundaryStyle(color));
			});
			this.listenTo(app.vent, 'stationDeselected', function(color, feature){
				feature.olToleranceFeature.setStyle(this.createToleranceStyle(color));
				feature.olBoundaryFeature.setStyle(this.createBoundaryStyle(color));
			});
			this.model.on('setBasicStyle', function(basicStyle) {
				this.updateStyle(basicStyle);
			}, this);

		},
		render: function(){
			//no op
		},
        drawStationDecorator: function(){
			//Used when editing feature position
            this.stationsDecorators = new ol.Collection();
            var tolerance = this.getToleranceFeature();
            var boundary = this.getBoundaryFeature();

            this.stationsDecorators.push(tolerance);
            this.stationsDecorators.push(boundary);
        },
		updateGeometryFromCoords: function(){
			var coords = this.model.get('point');
			var xcoords = transform(coords);
			//TODO this ought to have changed the openlayers geometry but does not seem to.
			this.olFeature.getGeometry().setCoordinates(xcoords);
			this.olFeature.changed();
			this.drawStationDecorator();
		},
		updateCoordsFromGeometry: function(geometry) {
			var coords = inverseTransform(geometry.getCoordinates());
			if (!$.arrayEquals(coords, this.model.get('point'))){
				this.model.set('point',coords);
				this.model.trigger('coordsChanged');
				this.drawStationDecorator();
				app.vent.trigger('appChanged');
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

	app.views.GroundOverlayEditView = app.views.GroundOverlayView.extend({
		initialize: function(options){
			app.views.GroundOverlayView.prototype.initialize.call(this, options);
			this.listenTo(this.model, 'change:coordinates', function() {
				this.updateGeometryFromCoords();
				app.util.updateJsonFeatures();
				app.Actions.action();
			});
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
			app.vent.trigger('appChanged');
		}
	});

});


