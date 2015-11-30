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

app.models = app.models || {};

(function(models) {

	function toJsonWithFilters() {
		var obj = Backbone.RelationalModel.prototype.toJSON.apply(this);
		_.each(_.keys(obj), function(key) {
			if (_.isNull(obj[key]) || _.contains(models.paramBlackList, key) ||
					(_.isString(obj[key]) && _.isEmpty(obj[key]))) {
				delete obj[key];
			}
		});
		return obj;
	};

	models.MapLayer = Backbone.RelationalModel.extend({
		idAttribute: 'uuid', //prevent clobbering mapLayer ID's
		url: function() {
			return app.options.saveMaplayerUrl;
		},
		relations: [  //MapLayer has many features
		              {
		            	  type: Backbone.HasMany,
		            	  relatedModel: 'app.models.Feature',
		            	  key: 'feature',
		            	  autofetch: true,
		            	  collectionType: 'app.models.FeatureCollection',
		            	  createModels: true,
		            	  reverseRelation: {
		            		  key: 'mapLayer',
		            		  includeInJSON: false
		            	  }
		              }
         ],
         toJSON: toJsonWithFilters
	});


	/*
	 * The Feature model represents all feature objects (Polygons, Lines, etc).
	 * This is inconvenient, but it has to be this way until we invent 
	 * a Collection that can instantiate more than one model type.
	 */
	models.Feature = Backbone.RelationalModel.extend({
		idAttribute: 'uuid',
//		url: function() {
//			return app.options.saveOrDeleteFeatureUrl;
//		},
        toString: function() {
        	var name = this.get('name');
            return name;
        },
		toJSON: toJsonWithFilters
	});

	models.FeatureCollection = Backbone.Collection.extend({
		model: models.Feature,
		url: function() {
			return '/xgds_map_server/feature';
		},
		initialize: function() {
		},
		removeFeature: function(featureModel) {
			this.remove(featureModel);
		}
	});

})(app.models);
