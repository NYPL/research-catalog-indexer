rm -r build

# Build dependencies:
npm i

# Move required application files into build:
cp *.js build/.
cp -R lib build/.
cp -R config build/.

cd build/
zip -qr build.zip *