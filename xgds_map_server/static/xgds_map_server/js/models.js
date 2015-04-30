// __BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

app.models = app.models || {};

(function(models) {

    // Map xpJSON parameter ValueTypes to backbone-forms schema field types
    models.paramTypeHash = {
        'string': 'Text',
        'integer': 'Number',
        'number': 'Number',
        'boolean': 'Checkbox',
        'date-time': 'DateTime',
        'targetId': 'Select',
        'h:m:s': 'HMS'
    };

    models.widgetTypeHash = {
        'text': 'Text',
        'number': 'Number',
        'checkbox': 'Checkbox',
        'datetime': 'DateTime',
        'select': 'Select',
        'textarea': 'TextArea',
        'h:m:s': 'HMS'
    };

    models.paramBlackList = [
        '_id',
        '_siteFrame'
    ];

    function xpjsonToBackboneFormsSchema(params, modelType) {

        // name and notes are hard-coded fields from xpjson spec
        var schema = {
            name: {type: 'Text'},
            notes: {type: 'TextArea'},
            id: {type: 'Text', readonly: true,
                 editorAttrs: { disabled: true}}
        };

        // data object contains object defaults
        var data = {
        };
        
        if (modelType == 'Info') {
        	schema.creator = {type: 'Text', readonly: true,
                    editorAttrs: { disabled: true }};
            schema.geometry = {type: 'Coordinates',
                    title: 'Lon, Lat'};
        }

        _.each(params, function(param) {
            var foundType;

            if (_.has(param, 'widget')) {
                foundType = app.models.widgetTypeHash[param.widget];
            } else {
                foundType = app.models.paramTypeHash[param.valueType];
            }

            if (foundType == 'Number' && (_.has(param, 'minimum') ||
                                          _.has(param, 'maximum'))) {
                foundType = 'MinMaxNumber';
            }

            if (_.has(param, 'choices') &&
                (foundType != 'Select' || foundType != 'Checkbox')) {
                if (foundType == 'Number') {
                    foundType = 'NumberSelect';
                } else {
                    foundType = 'Select';
                }
            }
            if (foundType == 'Select' || foundType == 'NumberSelect') {
                var options = _.map(param.choices, function(choice) {
                    var obj = {
                        val: choice[0],
                        label: choice[1]
                    };
                    return obj;
                });
                schema[param.id] = {'type': foundType, 'validators': [], options: options};
            } else {
                schema[param.id] = {'type': foundType, 'validators': []};
            }
            if (_.has(param, 'name')) {
                schema[param.id]['title'] = param.name;
            } else {
                // default to using parameter id for its name
                // your parameters shouldn't do this by default
                schema[param.id]['title'] = param.id;
            }
            if (param.valueType != 'boolean' &&
                _.has(param, 'required') &&
                _.isBoolean(param.required) &&
                param.required) {
                schema[param.id]['validators'].push('required');
            }
            if (_.has(param, 'notes')) {
                schema[param.id]['help'] = param.notes;
            }
            if (_.has(param, 'default')) {
                data[param.id] = param.default;
            }
            if (_.has(param, 'unit')) {
                schema[param.id]['unit'] = param.unit;
            }
            if (_.has(param, 'minimum')) {
                schema[param.id]['minimum'] = param.minimum;
            }
            if (_.has(param, 'maximum')) {
                schema[param.id]['maximum'] = param.maximum;
            }
            if (_.has(param, 'strictMinimum')) {
                schema[param.id]['strictMinimum'] = param.strictMinimum;
            }
            if (_.has(param, 'strictMaximum')) {
                schema[param.id]['strictMaximum'] = param.strictMaximum;
            }
            if (_.has(param, 'visible') &&
                    _.isBoolean(param.visible) &&
                    !param.visible) {
                schema[param.id]['type'] = 'Hidden';
            }
            if (_.has(param, 'editable') &&
                    _.isBoolean(param.editable) &&
                    !param.editable) {
                schema[param.id]['editorAttrs'] = {
                        readonly: true,
                        disabled: true
                    };
            }
        });

        return {
            schema: schema,
            data: data
        };
    }

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
	  idAttribute: '_id', //prevent clobbering mapLayer ID's
	  initialize: function() {
		  this._name = app.options.mapLayerDict['name'];
		  this._description = app.options.mapLayerDict['description'];
		  this._modifier = app.options.mapLayerDict['modifier'];
		  this._modified = app.options.mapLayerDict['modification_time'];
		  this._creator = app.options.mapLayerDict['creator'];
		  this._created = app.options.mapLayerDict['creation_time'];
	  },
     relations: [
         {
             type: Backbone.HasMany,
             relatedModel: 'app.models.Feature',
             key: 'feature',
             collectionType: 'app.models.FeatureCollection',
             createModels: true,
             reverseRelation: {
                 key: 'belongsTo',
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
	 idAttribute: '_id',
	 initialize: function() {
		this._name = undefined;
		this._description = undefined;
		this._type = undefined;
		this._visible = true;
	 },
	 toJSON: toJsonWithFilters
  });
  
  models.FeatureCollection = Backbone.Collection.extend({
	 model: models.Feature,
	 initialize: function() {
		 
	 }
  });
  
})(app.models);
