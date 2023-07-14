rm -r build
mkdir build

# Move required application files into build:
cp package.json build/.
cp package-lock.json build/.
cp -R lib build/.
cp -R config build/.
cp -R routes build/.
npm i

cd build/
zip -qr build.zip *