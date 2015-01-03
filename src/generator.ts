/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');
import inflection = require('inflection');
import Vinyl = require('vinyl');

import IEnvironment = require('./environments/i_environment');
import Symbol = require('./symbol');
import Plugin = require('./plugin');
import LocalHandlebars = require('./local_handlebars');

interface IHandlebarsTemplate {
  (context: any, options?: any): string;
}

class Generator {
  private fileDataCache: { [index: string]: string } = {};
  private templateCache: { [index: string]: IHandlebarsTemplate } = {};
  public files: Vinyl[] = [];

  constructor(
      public env: IEnvironment,
      public outputDirectory: string,
      public pluginDirectory: string,
      private handlebarsOptions: Plugin.IHandlebarsOptions) {
    this.outputDirectory = this.env.resolvePath(this.outputDirectory);
  }

  public generateUnlessExist(src: string, dest: string, context: Object = null): Vinyl {
    return this.generate(src, dest, context, false);
  }

  public generate(src: string, dest: string, overwrite?: boolean): Vinyl;
  public generate(src: string, dest: string, context: Object, overwrite?: boolean): Vinyl;
  public generate(src: string, dest: string, context: any, overwrite?: boolean): Vinyl {
    if (_.isBoolean(context)) {
      overwrite = <boolean>context;
      context = null;
    }

    if (context instanceof Symbol.Type) {
      dest = this.replaceStarsOfFileName(dest, <Symbol.Type>context);
    }
    var resolvedDest = this.env.resolvePath(this.outputDirectory, dest);

    var data = context !== null && /^.+\.hbs$/.test(src) ?
      this.getTemplate(src)(context, this.handlebarsOptions) :
      this.getFileFromPluginDirectory(src);

    if (_.contains([true, undefined], overwrite) || !this.env.exists(resolvedDest)) {
      var file = this.createFile({
        cwd: this.env.currentDirectory,
        base: this.outputDirectory,
        path: resolvedDest,
        contents: data
      });
      this.files.push(file);
      return file;
    }
    return null;
  }

  public createFile(options: { cwd?: string; base?: string; path?: string; contents?: any; }): Vinyl {
    if (_.isString(options.contents)) {
      options.contents = new Buffer(options.contents);
    }
    return new Vinyl(options);
  }

  public replaceStarsOfFileName(fileName: string, type: Symbol.Type): string {
    var matches = fileName.match(/(underscore|upperCamelCase|lowerCamelCase)?:?(.*\*.*)/);
    if (matches == null) { return fileName; }

    var inflect = (name: string, inflectionType: string): string => {
      switch (inflectionType) {
        case 'underscore':     return inflection.underscore(name);
        case 'upperCamelCase': return inflection.camelize(name);
        case 'lowerCamelCase': return inflection.camelize(name, true);
        default:               return name;
      }
    };
    return matches[2]
      .replace('**', type.moduleNames.map(n => inflect(n, matches[1])).join('/'))
      .replace('*', inflect(type.name, matches[1]))
      .replace(/^\//, ''); // Avoid making an absolute path
  }

  private getFileFromPluginDirectory(fileName: string): string {
    var filePath = this.env.resolvePath(this.pluginDirectory, fileName);

    if (!this.fileDataCache[filePath]) {
      this.fileDataCache[filePath] = this.env.readFile(filePath);
    }
    return this.fileDataCache[filePath];
  }

  private getTemplate(templateName: string): IHandlebarsTemplate {
    var filePath = this.env.resolvePath(this.pluginDirectory, templateName);

    if (!this.templateCache[filePath]) {
      var templateSource = this.getFileFromPluginDirectory(filePath);
      this.templateCache[filePath] = LocalHandlebars.handlebars.compile(templateSource);
    }
    return this.templateCache[filePath];
  }
}

export = Generator;
