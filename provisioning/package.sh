rm -r build
mkdir build

# Move required application files into build:
cp package.json build/.
cp package-lock.json build/.
cp index.js
cp -R lib build/.
cp -R config build/.
cp -R routes build/.

cd build/
npm i
zip -qr build.zip *