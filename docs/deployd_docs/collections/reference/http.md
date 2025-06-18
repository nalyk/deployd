<!--{
  title: 'Over HTTP',
  tags: ['reference', 'collection', 'http', 'websockets', 'cors']
}-->

## Accessing Collections Over HTTP

Deployd exposes an HTTP API to your Collections which can be used by any platform or library that supports HTTP or AJAX. Though it does not strictly adhere to REST, it should also work with most libraries designed for REST.

### Collection API

The examples below use a Collection called `/todos` with the following schema:

- `id`
- string `title`
- string `category`

Your Collection is available at the URL you specified. If you are using the default development hostname of `localhost:2403`, for example, the `/todos` collection will be available at `http://localhost:2403/todos`.

#### Requests <!-- ref -->

A request to the Deployd API should include the `Content-Type` header. The following content types are supported:

- `application/json` (recommended)
- `application/x-www-form-urlencoded` (All values will be parsed as strings)

The `Content-Type` header is not necessary for `GET` or `DELETE` requests which have no body.

#### Responses <!-- ref -->

Deployd will send standard HTTP status codes depending on the results on an operation. If the code is 200 (OK), the request was successful and the result is available in the body as JSON.

If the code is 204 (No Content), the request was successful, but there is no result.

If the code is 400 or greater, it will return the error message formatted as a JSON object:

 - `status` (number): The HTTP status code of the request. Common codes include:
  - 400 - Bad Request: The request contained invalid data and could not be completed
  - 401 - Unauthorized: The current session is not authorized to perform that action
  - 500 - Internal Server Error: Something went wrong on the server
 - `message` (string): A message describing the error. Not always present.
 - `errors` (object): A hash of error messages corresponding to the properties of the object that was sent - usually indicates validation errors. Not always present.

Examples of errors:
  
    {
      "status": 401,
      "message": "You are not allowed to access that collection!"
    }

<!--...-->

    {
      "status": 400,
      "errors": {
          "title": "Title must be less than 100 characters",
          "category": "Not a valid category"
      }
    }

#### Listing Data <!-- ref -->

To retreive an array of objects in the collection, send a `GET` request to your collection's path:

    GET /todos

The response will be an array of objects: 

    200 OK
    [
      {
        "id": "320d6151a9aad8ce",
        "title": "Wash the dog",
        "category": "pets"
      }, {
        "id": "320d6151a9aad8ce"
        "title": "Write autobiography",
        "category": "writing"
      }
    ]

If the collection has no objects, it will be an empty array:

    200 OK
    []    

#### Querying Data <!-- ref -->

To filter results by the specified query object, send a `GET` request to your collection's path with a query string.  See [Querying Collections](/docs/collections/reference/querying-collections.md) for information on constructing a query.

    GET /todos?category=pets

For more advanced queries, you will need to pass the query string as JSON instead:

    GET /todos?{"category": "pets"}

The response body is an array of objects: 

    200 OK
    [
      {
        "id": "320d6151a9aad8ce",
        "title": "Wash the dog",
        "category": "pets"
      }
    ]

#### Getting a Specific Object <!-- ref -->

To retrieve a single object by its `id` property, send a `GET` request with the `id` value as the path.

    GET /todos/320d6151a9aad8ce

The response body is the object that you requested:

    200 OK
    {
      "id": "320d6151a9aad8ce",
      "title": "Wash the dog",
      "category": "pets"
    }

#### Creating an Object <!-- ref -->

To create an object in the collection, send a `POST` request with the object's properties in the body.

    POST /todos
    {
      "title": "Walk the dog"
    }

The response body is the object that you posted, with any additional calculated properties and the `id`:

    {
      "id": "91c621a3026ca8ef",
      "title": "Walk the dog"
    }

#### Updating an Object <!-- ref -->

To update an object that is already in the collection, send a `POST` or `PUT` request with the `id` value as the path and with the properties you wish to update in the body. It will only change the properties that are provided. It is also possible to incrementally update certain properties; see [Updating Objects in Collections](/docs/collections/reference/updating-objects.md) for details.

    PUT /todos/91c621a3026ca8ef
    {
      "title": "Walk the cat"
    }

<!--...-->

    POST /todos/91c621a3026ca8ef
    {
      "title": "Walk the cat"
    }

You can also omit the `id` in the path if you provide an `id` property in the body:

    PUT /todos
    {
      "id": "91c621a3026ca8ef"
      "title": "Walk the cat"
    }

Finally, you can provide a query string to ensure that the object you are updating has the correct properties. You must still provide an `id`. This can be useful as a failsafe.

    PUT /todos/91c621a3026ca8ef?category=pets
    {
      "title": "Walk the cat"
    }

The response body is the entire object after the update:

    200 OK  
    {
      "id": "91c621a3026ca8ef",
      "title": "Walk the cat",
      "category": "pets"
    }

The `PUT` verb will return an error if the `id` and/or `query` does not match any object in the collection:

    400 Bad Request
    {
      "status": 400,
      "message": "No object exists that matches that query"
    }

#### Deleting an Object <!-- ref -->

To delete an object from the collection, send a `DELETE` request with the `id` value as a path.

    DELETE /todos/91c621a3026ca8ef

You can also pass a query string to ensure that you are removing the correct object:

    DELETE /todos/91c621a3026ca8ef?title=Walk the dog

You can omit the `id` in the path if you provide it in the query string:
  
    DELETE /todos?id=91c621a3026ca8ef&title=Walk the dog

The response body will always be empty.

### Realtime API

Deployd uses [Socket.io](http://socket.io/#home) for its realtime functionality. If you are not using dpd.js, you can use the [Socket.io client library](https://github.com/LearnBoost/socket.io-client/blob/master/dist/socket.io.js). 

    var socket = io.connect('/');
    socket.on('todos:create', function(todo) {
      // Do something
    });

The Socket.io community has created client libraries for other languages and platforms as well.


### Root Requests

You can elevate your session to root access by adding the header `dpd-ssh-key`. It must have the value of your app's key (you can find this by typing `dpd showkey` into the command line); although in the `development` environment, the `dpd-ssh-key` header can have any value.

Sending a request as root has several effects. Most notably, you can use the `{$skipEvents: true}` property in either the query string or request body. This will cause events not to run. This is useful for bypassing authentication or validation. 

Your front-end app should never gain root access, and you should never store the app's key in a place where it can be accessed by users, even if they understand the system. This is primarily useful for writing data management utilities for yourself, other developers, and system administrators.

### Examples

The examples below show how to use various JavaScript front-end libraries to access a Collection called `/todos`.

#### [jQuery](http://jquery.com/)

    $.ajax('/todos', {
      type: "GET",
      success: function(todos) {
        // Do something
      },
      error: function(xhr) {
        alert(xhr.responseText);
      }
    });

    $.ajax('/todos', {
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        title: "Walk the dog"
      }),
      success: function(todo) {
        // Do something
      }, 
      error: function(xhr) {
        alert(xhr.responseText);
      }
    });

*Note: When providing a request body, jQuery defaults to form encoding. Deployd works best with a JSON body, so you'll need to set the contentType option and manually convert to JSON.*

#### [Backbone.js](http://backbonejs.org)

    var Todo = Backbone.Model.extend({});
    var Todos = Backbone.Collection.extend({
      model: Todo,
      url: "/todos"
    });

    var todos = new Todos();  

    todos.fetch({
      success: function(collection, response) {
        // Do something
      }, error: function(collection, response) {
        alert(response);
      }
    });

    todos.create({
      title: "Walk the dog"
    }, {
      success: function(collection, response) {
        // Do something
      }, error: function(collection, response) {
        alert(response);
      }
    });


#### [Angular.js](http://angularjs.org/)

Using [$http](http://docs.angularjs.org/api/ng.$http):
  
    function Controller($scope, $http) {
      $http.get('/todos')
        .success(function(todos) {
          $scope.todos = todos;
        })
        .error(function(err) {
          alert(err);
        });

      $http.post('/todos', {
          title: "Walk the dog"
        })
        .success(function(todo) {
          // Do something
        })
        .error(function(err) {
          alert(err);
        });
    }

Using [ngResource](http://docs.angularjs.org/api/ngResource.$resource):

    var myApp = angular.module('myApp', ['ngResource']);

    myApp.factory('Todos', function($resource) {
      return $resource('/todos/:todoId', {todoId: '@id'});
    });

    function Controller($scope, Todos) {
      $scope.todos = Todos.query(function(response) {
        // Do something
      }, function(error) {
        alert(error);
      });

      Todos.save({
        title: "Walk the dog"
      }, function(todo) {
        // Do something
      }, function(error) {
        alert(error);
      });
    }

    myApp.controller('Controller', Controller);


### Cross-Origin Requests
The most common bug when implementing a CORS client for Deploy is to include headers that are not allowed. A client must not send any custom headers besides the following:


    Origin, Accept, Accept-Language, Content-Language, Content-Type, Last-Event-ID

This will not work on browsers that do not support Cross-Origin Resource Sharing (namely Internet Explorer 7 and below).

#### Cross-Origin Requests with dpd.js
When using dpd.js, all the required CORS headers are sent by default to any domain.  You don't have to make any changes to your requests.  dpd.js takes care of it for you.

#### Cross-Origin Requests with jQuery

When using jQuery.ajax() on cross-origin requests the credentials are not sent along with the request automatically.  You have to add them to each ajax() request using the xhrFields parameter.  Here is an example  of login followed by getting some data.

	// Logging a user in.
	$.ajax({
	  url: 'http://<domain>:<port>/users/login',
	  type: "POST",
	  data: {username:"un", password:"pw"},
	  cache: false,
	  xhrFields:{
	    withCredentials: true
	  },
	  success: function(data) {
	    console.log(data);
	  },
	  error: function(xhr) {
	    console.log(xhr.responseText);
	  }
	});

	// On subsequent requests or in the success callback above.  (After having logged in) 
	$.ajax({
	  url: 'http://<domain>:<port>/<collection>',
	  type: "GET",
	  cache: false,
	  xhrFields:{
	    withCredentials: true
	  },
	  success: function(data) {
	    console.log(data);
	  },
	  error: function(xhr) {
	    console.log(xhr.responseText);
	  }
	});

### HTTP method override

Provides faux HTTP method support.

Most browsers doesn’t support methods other than “GET” and “POST” when it comes to submitting forms. So It's support something like 'Rails'.

Pass an optional key to use when checking for a method override, othewise defaults to _method. The original method is available via req.originalMethod.

It's support both URL query and POST body

    URL       : ?_method=METHOD_NAME or
    JSON body : { _method: 'METHOD_NAME' }

$.ajax({
            type: "POST",
            url : "/todos/"+ todoId,
            data: { _method:"DELETE" },
            success: function(res) {
#### Ajax Example
    $.ajax({
      type : "POST",
      url  : "/todos/OBJECT_ID"
      data : { _method:"DELETE" },
      success: function(todo) {
        // Object was deleted. response body empty.
      }, 
      error: function(xhr) {}
    });

    or

    $.ajax({
      type : "POST",
      url  : "/todos/OBJECT_ID?_method=DELETE",
      success: function(todo) {
        // Object was deleted. response body empty.
      }, 
      error: function(xhr) {}
    });


