(function_definition
  body: (_) @function.inside) @function.around

(lambda
  body: (_) @function.inside) @function.around

(class_definition
  body: (_) @class.inside) @class.around

(union_definition
  body: (_) @class.inside) @class.around

(enum_definition
  body: (_) @class.inside) @class.around

(comment)+ @comment.around
