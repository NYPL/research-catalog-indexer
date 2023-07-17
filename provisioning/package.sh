rm -r build
mkdir build

# Move required application files into build:
cp package.json build/.
cp package-lock.json build/.
cp index.js build/.
cp -R lib build/.
cp -R data build/.

cd build/
npm i
zip -qr build.zip *