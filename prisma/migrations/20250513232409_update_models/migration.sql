/*
  Warnings:

  - You are about to drop the column `airline` on the `Flight` table. All the data in the column will be lost.
  - You are about to drop the column `origin` on the `Flight` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Restaurant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[flight_number]` on the table `Flight` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `arrival_time` to the `Flight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departure_time` to the `Flight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration` to the `Flight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flight_name` to the `Flight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flight_number` to the `Flight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `Flight` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `date` on the `Flight` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `availability` to the `Hotel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `room_price` to the `Hotel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stars` to the `Hotel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `Restaurant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price_range` to the `Restaurant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Flight" DROP COLUMN "airline",
DROP COLUMN "origin",
ADD COLUMN     "arrival_time" TEXT NOT NULL,
ADD COLUMN     "departure_time" TEXT NOT NULL,
ADD COLUMN     "duration" TEXT NOT NULL,
ADD COLUMN     "flight_name" TEXT NOT NULL,
ADD COLUMN     "flight_number" TEXT NOT NULL,
ADD COLUMN     "source" TEXT NOT NULL,
DROP COLUMN "date",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Hotel" DROP COLUMN "price",
DROP COLUMN "rating",
ADD COLUMN     "availability" BOOLEAN NOT NULL,
ADD COLUMN     "room_price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "stars" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Restaurant" DROP COLUMN "city",
ADD COLUMN     "location" TEXT NOT NULL,
ADD COLUMN     "price_range" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Flight_flight_number_key" ON "Flight"("flight_number");
