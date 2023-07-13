rm -r build
mkdir build
cd build

# Build dependencies:
npm i
ls

# Move required application files into build:
cp ../*.js .
cp -R ../lib .
cp -R ../config .

zip -qr build.zip *