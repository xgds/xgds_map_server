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


/*
 ** Override the TemplateCache function responsible for
 ** rendering templates so that it will use Handlebars.
 */
Marionette.TemplateCache.prototype.compileTemplate = function(
		rawTemplate, options) {
	return Handlebars.compile(rawTemplate, options);
};



//A view that iterates over a Backbone.Collection
//and renders an individual child view for each model.
//This version supports having a custom template just like Marionette.View
//You should define what element to use for the children with childrenEl property
Marionette.TemplateCollectionView = Marionette.CollectionView.extend({

	// You might need to override this if you've overridden attachHtml
	attachBuffer(collectionView, buffer) {
		collectionView.$childrenEl.append(buffer);
	},


	serializeModel: function serializeModel() {
		if (!this.model) {
			return {};
		}
		return _.clone(this.model.attributes);
	},

//	Serialize the view's model *or* collection, if
//	it exists, for the template
	serializeData() {
		if (!this.model && !this.collection) {
			return {};
		}

//		If we have a model, we serialize that
		if (this.model) {
			return this.serializeModel();
		}

//		Otherwise, we serialize the collection,
//		making it available under the `items` property
		return {
			items: this.serializeCollection()
		};
	},

//	Mix in template context methods. Looks for a
//	`templateContext` attribute, which can either be an
//	object literal, or a function that returns an object
//	literal. All methods and attributes from this object
//	are copies to the object passed in.
	mixinTemplateContext(target = {}) {
		const templateContext = _.result(this, 'templateContext');
		return _.extend(target, templateContext);
	},

//	Internal method to render the template with the serialized data
//	and template context via the `Marionette.Renderer` object.
	_renderTemplate: function _renderTemplate() {
		var template = this.template;
		var data = this.mixinTemplateContext(this.serializeData());
		var html = Marionette.Renderer.render(template, data, this);
		this.$el.html(html);
		if (!_.isUndefined(this.childrenEl)) {
			this.$childrenEl = this.$el.find(this.childrenEl);
		} else {
			this.$childreneEl = this.$el;
		}
	},

	// Render children views. Override this method to provide your own implementation of a
	// render function for the collection view.
	render() {
		this._ensureViewIsIntact();
		this.triggerMethod('before:render', this);
		this._renderTemplate();
		this._renderChildren();
		this.bindUIElements();
		this._isRendered = true;
		this.triggerMethod('render', this);
		return this;
	},



	// Internal method. Separated so that CompositeView can append to the childViewContainer
	// if necessary
	_appendReorderedChildren(children) {
		this.$childrenEl.append(children);
	},


	// You might need to override this if you've overridden attachHtml
	attachBuffer(collectionView, buffer) {
		collectionView.$childrenEl.append(buffer);
	},


	// Internal method. Check whether we need to insert the view into the correct position.
	_insertBefore(childView, index) {
		let currentView;
		const findPosition = this.sort && (index < this.children.length - 1);
		if (findPosition) {
			// Find the view after this one
			currentView = this.children.find((view) => {
				return view._index === index + 1;
			});
		}

		if (currentView) {
			currentView.$childrenEl.before(childView.el);
			return true;
		}

		return false;
	},

	// Internal method. Append a view to the end of the $el
	_insertAfter(childView) {
		this.$childrenEl.append(childView.el);
	},


});

(function( xGDS, $, _, Backbone, Marionette ) {

	xGDS.Actions = { 
		undoStack: new Array(),
		redoStack: new Array(),
		currentState: undefined,
		enabled: true,
		_disableCount: 0,
		_inAction: false,
		_enterAction: function() {
			this._inAction = true;
		},
		_exitAction: function() {
			this._inAction = false;
		},
		disable: function() {
			if (this._inAction)
				return;
			this._enterAction();
			this._disableCount += 1;
			this.enabled = false;
			this._exitAction();
		},
		enable: function() {
			if (this._inAction)
				return;
			this._enterAction();
			this._disableCount -= 1;
			if (this._disableCount <= 0) {
				this.enabled = true;
				this._disableCount = 0;
			}
			this._exitAction();
		},
		undoEmpty: function() {
			return this.undoStack.length == 0;
		},
		redoEmpty: function() {
			return this.redoStack.length == 0;
		},
		setInitial: function(force) {
			if (this.currentState == undefined || force !== undefined && force) {
				this.currentState = JSON.stringify(app.getSerializableObject().toJSON());
			}
		},
		resetCurrent: function() {
			if (this._inAction)
				return;
			this._enterAction();
			this.setInitial(true);
			this._exitAction();
		},
		action: function() {
			if (this._inAction)
				return;
			if (!this.enabled)
			return;
			if (this.currentState == undefined)
				return;
			this.disable();
			this._enterAction();
			var sObject = app.getSerializableObject().toJSON();
			var sObjectString = JSON.stringify(sObject);
			if (this.currentState == sObjectString) {
				// unchanged from current state
			} else {
				this.undoStack.push(this.currentState);
				this.currentState = sObjectString;
				this.redoStack = new Array();
				app.vent.trigger('undoNotEmpty');
				app.vent.trigger('redoEmpty');
				app.vent.trigger('actionOcurred');
			}
			this._exitAction();
			this.enable();
		},
		undo: function() {
			if (this._inAction)
				return;
			if (!this.enabled)
				return;
			this.disable();
			this._enterAction();
			var sObjectString = this.undoStack.pop();
			var sObject = JSON.parse(sObjectString);
			if (sObject == undefined) {
				app.vent.trigger('undoEmpty');
			} else {
				this.redoStack.push(this.currentState);
				this.currentState = sObjectString;
				app.updateSerializableObject(sObject);
				app.vent.trigger('redoNotEmpty');
				if (this.undoStack.length == 0)
					app.vent.trigger('undoEmpty');
			}
			this._exitAction();
			this.enable();
		},
		redo: function() {
			if (this._inAction)
				return;
			if (!this.enabled)
				return;
			this.disable();
			this._enterAction();
			var sObjectString = this.redoStack.pop();
			var sObject = JSON.parse(sObjectString);
			if (sObject == undefined) {
				app.vent.trigger('redoEmpty');
			} else {
				this.undoStack.push(this.currentState);
				this.currentState = sObjectString;
				app.updateSerializableObject(sObject);
				app.vent.trigger('undoNotEmpty');
				if (this.redoStack.length == 0)
					app.vent.trigger('redoEmpty');
			}
			this._exitAction();
			this.enable();
		}
	}
}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));