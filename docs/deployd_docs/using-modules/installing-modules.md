<!--{
  title: 'Installing a Module',
  tags: ['installing', 'module']
}-->

## Installing a Module

### From NPM

Deployd modules are 100% compatible with [node modules](http://npmjs.org). This means you can install a module with [npm](http://npmjs.org) from your project's root directory.

    cd my-dpd-project
    mkdir -p node_modules
    npm install my-dpd-module

To find deployd modules available on npm [search for `dpd`](https://encrypted.google.com/search?q=dpd&q=site:npmjs.org&hl=en).

If you need to use a task manager like Grunt or Gulp for your development environement, you'll have to add a package.json as explained [in this page](/docs/server/use-grunt-or-gulp.md).

### From Source

You can also install a module from source by putting it in your project's `node_modules` folder. Even a single file is valid (eg: `/node_modules/foo.js`).
