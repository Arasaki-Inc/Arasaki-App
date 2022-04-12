import 'dart:io';
import 'package:sass/sass.dart' as sass;

void main(List<String> arguments) {
  var result = sass.compileToResult(arguments[0], style: sass.OutputStyle.expanded, quietDeps: true, verbose: true, sourceMap: false, charset: true);
  var code = new File(arguments[1]);
  if (code.existsSync()) code.deleteSync();
  code.createSync();
  code.writeAsStringSync(result.css);
}
