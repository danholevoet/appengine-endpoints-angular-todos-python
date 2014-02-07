//
// Copyright 2014 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

/**
 * @fileoverview AngularJS module to drive the Todo application.
 *
 * Relies upon the googleapiProvider module for connecting to Google Cloud
 * Endpoints APIs (or other Google APIs).
 *
 * See https://developers.google.com/appengine/docs/python/endpoints/ for more
 * on building APIs with Google Cloud Endpoints.
 */

/** @type {!angular.Module}. */
var App = angular.module('todoapp', ['ngRoute',
    ng.googleapi.client.module.name]);

App.config(function(googleapiProvider, $routeProvider) {
  googleapiProvider.api('todo', 'v1',
      '//' + window.location.host + '/_ah/api');

  $routeProvider.when('/', {
    templateUrl: '/partials/todos.html',
    resolve: googleapiProvider.resolve(['todo']),
    controller: 'TodoCtrl'
  });
});

App.controller('TodoCtrl', function($scope, todo, googleapi) {
  $scope.todos = [];
  googleapi.execute(todo.todos.list()).then(function(result) {
    $scope.todos = result.items || [];
  });

  $scope.addTodo = function() {
    var newTodo = {
      text: $scope.todoText,
      done: false
    };
    googleapi.execute(todo.todos.insert(newTodo));
    $scope.todos.push(newTodo);
    $scope.todoText = '';
  };

  $scope.change = function(updated) {
    googleapi.execute(todo.todos.update(updated));
  }

  $scope.remaining = function() {
    var count = 0;
    angular.forEach($scope.todos, function(todo) {
      count += todo.done ? 0 : 1;
    });
    return count;
  };

  $scope.archive = function() {
    $scope.todos = $scope.todos.filter(function(todo) {
      return !todo.done;
    })
  };
});
