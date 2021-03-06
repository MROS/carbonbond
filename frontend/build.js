const webpack = require('webpack');
const config = require('./webpack.config.js');
const { execSync } = require('child_process');
const watch = require('node-watch');
require('colors');

const argv = require('minimist')(process.argv.slice(2));

const handler = (err, stats) => {
	if (err) {
		console.error(err);
		return;
	}

	console.log(stats.toString({
		chunks: false,
		colors: true,
		cached: false,
	}));
};

const compiler = webpack(config);

function protobuf_compile() {
	const out = `${__dirname}/src/ts/protobuf/chat_proto.js`;
	const args = ['--target', 'static-module',
		'-w', 'es6',
		'--force-number',
		'-o', out,
		`${__dirname}/../api/protobuf/chat.proto`].join(' ');
	try {
		execSync(`npx pbjs ${args}` , { stdio: 'pipe' });
		execSync(`npx pbts -o ${__dirname}/src/ts/protobuf/chat_proto.d.ts ${out}` , { stdio: 'pipe' });
		console.log('protobuf 編譯完成'.green);
	} catch (err) {
		console.log('protobuf 編譯錯誤：');
		console.log(err.stderr.toString().red);
	}
}

function api_codegen() {
	try {
		execSync('yarn api-codegen', { stdio: 'inherit' });
		console.log('graphql 編譯完成'.green);
	} catch (err) {
		console.log('graphql 編譯錯誤'.red);
	}
}

if (argv['watch']) {
	// protobuf
	protobuf_compile();
	watch(`${__dirname}/../api/protobuf`, protobuf_compile);
	// api codegen
	api_codegen();
	watch(`${__dirname}/../api/api.gql`, api_codegen);
	watch(`${__dirname}/operation`, api_codegen);

	// webpack
	compiler.watch({
		aggregateTimeout: 300,
		poll: undefined
	}, handler);
} else {
	// protobuf
	protobuf_compile();

	// api codegen
	api_codegen();

	// webpack
	compiler.run(handler);
}
